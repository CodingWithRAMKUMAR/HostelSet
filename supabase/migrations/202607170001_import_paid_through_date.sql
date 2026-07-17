-- Explicit rent baseline for existing-tenant imports.
-- Null is allowed for legacy rows; application code keeps the conservative
-- fallback for those records.

alter table public.existing_tenant_imports
  add column if not exists paid_through_date date;

alter table public.tenants
  add column if not exists paid_through_date date;

comment on column public.existing_tenant_imports.paid_through_date is
  'Due date of the latest monthly rent already paid before the existing tenant import was submitted.';

comment on column public.tenants.paid_through_date is
  'Snapshot of the last paid monthly rent due date before online onboarding/import; used as the rent baseline.';

alter table public.existing_tenant_imports
  drop constraint if exists existing_tenant_imports_paid_through_not_before_move_in;

alter table public.existing_tenant_imports
  add constraint existing_tenant_imports_paid_through_not_before_move_in
  check (paid_through_date is null or paid_through_date >= move_in_date);

alter table public.tenants
  drop constraint if exists tenants_paid_through_not_before_move_in;

alter table public.tenants
  add constraint tenants_paid_through_not_before_move_in
  check (paid_through_date is null or paid_through_date >= move_in_date);

-- Imported historical rent is represented by paid_through_date only.
-- tenants.total_paid remains HostelSet-recorded confirmed payment history and
-- starts at zero for imported tenants; no synthetic payment_history rows are
-- created for pre-import rent.
create or replace function public.calculate_imported_tenant_initial_rent_state(
  p_move_in_date date,
  p_paid_through_date date,
  p_current_rent numeric,
  p_reference_date date default current_date
)
returns table (
  pending_amount numeric,
  total_paid numeric,
  rent_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  monthly_rent numeric := greatest(coalesce(p_current_rent, 0), 0);
  anchor_day integer;
  next_due_date date;
  next_month_start date;
begin
  total_paid := 0;

  if p_move_in_date is null or monthly_rent <= 0 then
    pending_amount := 0;
    rent_status := 'paid';
    return next;
    return;
  end if;

  -- Legacy pending import rows without an explicit baseline cannot prove any
  -- current due cycle is paid. Keep the fallback conservative.
  if p_paid_through_date is null then
    if p_move_in_date <= p_reference_date then
      pending_amount := monthly_rent;
      rent_status := 'pending';
    else
      pending_amount := 0;
      rent_status := 'paid';
    end if;
    return next;
    return;
  end if;

  anchor_day := extract(day from p_move_in_date)::integer;
  next_due_date := p_move_in_date;

  while next_due_date <= p_paid_through_date loop
    next_month_start := (date_trunc('month', next_due_date)::date + interval '1 month')::date;
    next_due_date := (
      next_month_start
      + (
        least(
          anchor_day,
          extract(day from (next_month_start + interval '1 month - 1 day'))::integer
        ) - 1
      ) * interval '1 day'
    )::date;
  end loop;

  if next_due_date <= p_reference_date then
    pending_amount := monthly_rent;
    rent_status := 'pending';
  else
    pending_amount := 0;
    rent_status := 'paid';
  end if;
  return next;
end;
$$;

revoke all on function public.calculate_imported_tenant_initial_rent_state(date, date, numeric, date) from public, anon, authenticated;

create or replace function public.approve_existing_tenant_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  new_tenant_id uuid;
  rent_state record;
begin
  select * into import_record
  from public.existing_tenant_imports
  where id = p_import_id
  for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;

  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status = 'approved' then
    return jsonb_build_object('success', true, 'tenant_id', import_record.tenant_id, 'status', 'approved');
  end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Import submission has already been processed'; end if;

  select * into room_record
  from public.rooms
  where id = import_record.room_id and property_id = import_record.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'Selected room is full'; end if;

  if exists (
    select 1 from public.tenants tenant
    where tenant.property_id = import_record.property_id
      and (
        tenant.user_id = import_record.user_id
        or tenant.phone = import_record.phone
        or lower(tenant.email) = lower(import_record.email)
      )
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Tenant already exists for this property'; end if;

  select * into rent_state
  from public.calculate_imported_tenant_initial_rent_state(
    import_record.move_in_date,
    import_record.paid_through_date,
    import_record.current_rent,
    current_date
  );

  insert into public.tenants(
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, paid_through_date, status
  ) values (
    import_record.user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email,
    import_record.current_rent, rent_state.pending_amount, rent_state.total_paid, rent_state.rent_status, import_record.move_in_date,
    import_record.paid_through_date, 'active'
  ) returning id into new_tenant_id;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.existing_tenant_imports
  set status = 'approved', tenant_id = new_tenant_id, rejection_reason = null,
      processed_at = now(), processed_by = auth.uid(), updated_at = now()
  where id = import_record.id;

  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

create or replace function public.approve_existing_tenant_import_with_user(p_import_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  effective_user_id uuid;
  new_tenant_id uuid;
  rent_state record;
begin
  if p_user_id is null then raise exception 'Tenant account is missing'; end if;
  select * into import_record from public.existing_tenant_imports where id = p_import_id for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;
  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status = 'approved' then return jsonb_build_object('success', true, 'tenant_id', import_record.tenant_id, 'status', 'approved'); end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Import submission has already been processed'; end if;
  effective_user_id := coalesce(import_record.user_id, p_user_id);
  select * into room_record from public.rooms where id = import_record.room_id and property_id = import_record.property_id for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'Selected room is full'; end if;
  if exists (select 1 from public.tenants tenant where tenant.property_id = import_record.property_id and (tenant.user_id = effective_user_id or tenant.phone = import_record.phone or lower(tenant.email) = lower(import_record.email)) and tenant.status in ('active','notice_period','payment_pending')) then raise exception 'Tenant already exists for this property'; end if;

  select * into rent_state
  from public.calculate_imported_tenant_initial_rent_state(
    import_record.move_in_date,
    import_record.paid_through_date,
    import_record.current_rent,
    current_date
  );

  insert into public.tenants(user_id, property_id, room_id, name, phone, email, blood_group, rent_amount, pending_amount, total_paid, rent_status, move_in_date, paid_through_date, status, profile_photo_path)
  values (
    effective_user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email, import_record.blood_group,
    import_record.current_rent, rent_state.pending_amount, rent_state.total_paid, rent_state.rent_status, import_record.move_in_date,
    import_record.paid_through_date, 'active',
    case
      when import_record.profile_photo like import_record.property_id::text || '/imports/photos/%'
        and import_record.profile_photo !~ '(^/|\\.\\.|//|[?#])'
      then import_record.profile_photo
      else null
    end
  )
  returning id into new_tenant_id;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1, status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end, updated_at = now() where id = room_record.id;
  update public.existing_tenant_imports set status = 'approved', user_id = effective_user_id, tenant_id = new_tenant_id, rejection_reason = null, processed_at = now(), processed_by = auth.uid(), updated_at = now() where id = import_record.id;
  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

revoke all on function public.approve_existing_tenant_import(uuid) from public, anon;
revoke all on function public.approve_existing_tenant_import_with_user(uuid, uuid) from public, anon;
grant execute on function public.approve_existing_tenant_import(uuid) to authenticated;
grant execute on function public.approve_existing_tenant_import_with_user(uuid, uuid) to authenticated;
