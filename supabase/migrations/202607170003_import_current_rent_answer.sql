-- Explicit current-cycle rent answer for existing-tenant imports.
-- Forward-only follow-up to 202607170001, which is already applied in production.
-- Nulls are allowed for legacy rows; approval keeps the conservative fallback
-- when an older import has no current-cycle answer.

alter table public.existing_tenant_imports
  add column if not exists current_rent_due_date date,
  add column if not exists current_rent_cycle_paid boolean;

alter table public.tenants
  add column if not exists current_rent_due_date date,
  add column if not exists current_rent_cycle_paid boolean;

comment on column public.existing_tenant_imports.current_rent_due_date is
  'Rent due date for the current monthly cycle at existing-tenant import submission time.';
comment on column public.existing_tenant_imports.current_rent_cycle_paid is
  'Tenant/owner reviewed answer to whether the current import rent cycle has already been paid.';
comment on column public.existing_tenant_imports.paid_through_date is
  'Derived due date of the latest monthly rent already paid for import baseline purposes; never an advance-rent date.';

comment on column public.tenants.current_rent_due_date is
  'Snapshot of the import current rent due date used to initialize imported tenant rent state.';
comment on column public.tenants.current_rent_cycle_paid is
  'Snapshot of the import answer used to initialize imported tenant rent state.';
comment on column public.tenants.paid_through_date is
  'Snapshot of the imported rent baseline. Historical imported rent is not represented as payment_history or total_paid.';

alter table public.existing_tenant_imports
  drop constraint if exists existing_tenant_imports_paid_through_not_before_move_in;
alter table public.tenants
  drop constraint if exists tenants_paid_through_not_before_move_in;

alter table public.existing_tenant_imports
  drop constraint if exists existing_tenant_imports_current_due_not_before_move_in;
alter table public.existing_tenant_imports
  add constraint existing_tenant_imports_current_due_not_before_move_in
  check (current_rent_due_date is null or move_in_date is null or current_rent_due_date >= move_in_date);

alter table public.existing_tenant_imports
  drop constraint if exists existing_tenant_imports_paid_through_not_after_current_due;
alter table public.existing_tenant_imports
  add constraint existing_tenant_imports_paid_through_not_after_current_due
  check (paid_through_date is null or current_rent_due_date is null or paid_through_date <= current_rent_due_date);

alter table public.tenants
  drop constraint if exists tenants_current_due_not_before_move_in;
alter table public.tenants
  add constraint tenants_current_due_not_before_move_in
  check (current_rent_due_date is null or move_in_date is null or current_rent_due_date >= move_in_date);

alter table public.tenants
  drop constraint if exists tenants_paid_through_not_after_current_due;
alter table public.tenants
  add constraint tenants_paid_through_not_after_current_due
  check (paid_through_date is null or current_rent_due_date is null or paid_through_date <= current_rent_due_date);

create or replace function public.calculate_import_current_rent_due_date(
  p_move_in_date date,
  p_reference_date date default current_date
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  anchor_day integer;
  month_offset integer;
  target_month_start date;
  candidate date;
begin
  if p_move_in_date is null or p_reference_date is null then
    return null;
  end if;

  anchor_day := extract(day from p_move_in_date)::integer;
  month_offset := ((extract(year from p_reference_date)::integer - extract(year from p_move_in_date)::integer) * 12)
    + (extract(month from p_reference_date)::integer - extract(month from p_move_in_date)::integer);
  month_offset := greatest(month_offset, 0);

  target_month_start := (date_trunc('month', p_move_in_date)::date + make_interval(months => month_offset))::date;
  candidate := (
    target_month_start
    + (
      least(anchor_day, extract(day from (target_month_start + interval '1 month - 1 day'))::integer) - 1
    ) * interval '1 day'
  )::date;

  if candidate > p_reference_date and month_offset > 0 then
    target_month_start := (date_trunc('month', p_move_in_date)::date + make_interval(months => month_offset - 1))::date;
    candidate := (
      target_month_start
      + (
        least(anchor_day, extract(day from (target_month_start + interval '1 month - 1 day'))::integer) - 1
      ) * interval '1 day'
    )::date;
  end if;

  return candidate;
end;
$$;

create or replace function public.calculate_import_previous_rent_due_date(
  p_move_in_date date,
  p_current_due_date date
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  anchor_day integer;
  month_offset integer;
  target_month_start date;
begin
  if p_move_in_date is null or p_current_due_date is null then
    return null;
  end if;

  anchor_day := extract(day from p_move_in_date)::integer;
  month_offset := ((extract(year from p_current_due_date)::integer - extract(year from p_move_in_date)::integer) * 12)
    + (extract(month from p_current_due_date)::integer - extract(month from p_move_in_date)::integer) - 1;
  target_month_start := (date_trunc('month', p_move_in_date)::date + make_interval(months => month_offset))::date;

  return (
    target_month_start
    + (
      least(anchor_day, extract(day from (target_month_start + interval '1 month - 1 day'))::integer) - 1
    ) * interval '1 day'
  )::date;
end;
$$;

-- Imported historical rent is represented by paid_through_date only.
-- tenants.total_paid remains HostelSet-recorded confirmed payment history and
-- starts at zero for imported tenants; no synthetic payment_history rows are
-- created for pre-import rent.
create or replace function public.calculate_imported_tenant_initial_rent_state(
  p_move_in_date date,
  p_current_rent_due_date date,
  p_current_rent_cycle_paid boolean,
  p_current_rent numeric,
  p_reference_date date default current_date,
  p_legacy_paid_through_date date default null
)
returns table (
  pending_amount numeric,
  total_paid numeric,
  rent_status text,
  paid_through_date date,
  current_rent_due_date date,
  current_rent_cycle_paid boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  monthly_rent numeric := greatest(coalesce(p_current_rent, 0), 0);
  resolved_due_date date;
  resolved_cycle_paid boolean;
begin
  total_paid := 0;
  resolved_due_date := coalesce(p_current_rent_due_date, public.calculate_import_current_rent_due_date(p_move_in_date, p_reference_date));

  if p_move_in_date is null or resolved_due_date is null or monthly_rent <= 0 then
    pending_amount := 0;
    rent_status := 'paid';
    paid_through_date := null;
    current_rent_due_date := resolved_due_date;
    current_rent_cycle_paid := null;
    return next;
    return;
  end if;

  if p_current_rent_cycle_paid is null then
    -- Compatibility for legacy import rows: an explicit old paid-through date
    -- can prove the current cycle only up to the calculated current due date.
    -- If no explicit answer/date exists, do not infer that the current cycle
    -- was paid from import or approval timestamps.
    resolved_cycle_paid := coalesce(p_legacy_paid_through_date >= resolved_due_date, false);
  else
    resolved_cycle_paid := p_current_rent_cycle_paid;
  end if;

  current_rent_due_date := resolved_due_date;
  current_rent_cycle_paid := resolved_cycle_paid;

  if resolved_cycle_paid then
    paid_through_date := resolved_due_date;
    pending_amount := 0;
    rent_status := 'paid';
  else
    paid_through_date := public.calculate_import_previous_rent_due_date(p_move_in_date, resolved_due_date);
    pending_amount := monthly_rent;
    rent_status := 'pending';
  end if;

  return next;
end;
$$;

create or replace function public.update_existing_tenant_import_rent_answer(
  p_import_id uuid,
  p_current_rent_cycle_paid boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  property_owner uuid;
  resolved_current_due date;
  resolved_paid_through date;
begin
  if p_current_rent_cycle_paid is null then
    raise exception 'Current rent cycle answer is required';
  end if;

  select * into import_record
  from public.existing_tenant_imports
  where id = p_import_id
  for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;

  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Only pending import submissions can be corrected'; end if;

  resolved_current_due := coalesce(import_record.current_rent_due_date, public.calculate_import_current_rent_due_date(import_record.move_in_date, current_date));
  if resolved_current_due is null then raise exception 'Current rent due date could not be calculated'; end if;

  if p_current_rent_cycle_paid then
    resolved_paid_through := resolved_current_due;
  else
    resolved_paid_through := public.calculate_import_previous_rent_due_date(import_record.move_in_date, resolved_current_due);
  end if;

  update public.existing_tenant_imports
  set current_rent_due_date = resolved_current_due,
      current_rent_cycle_paid = p_current_rent_cycle_paid,
      paid_through_date = resolved_paid_through,
      updated_at = now()
  where id = import_record.id;

  return jsonb_build_object(
    'success', true,
    'current_rent_due_date', resolved_current_due,
    'current_rent_cycle_paid', p_current_rent_cycle_paid,
    'paid_through_date', resolved_paid_through
  );
end;
$$;

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
    import_record.current_rent_due_date,
    import_record.current_rent_cycle_paid,
    import_record.current_rent,
    current_date,
    import_record.paid_through_date
  );

  insert into public.tenants(
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, current_rent_due_date,
    current_rent_cycle_paid, paid_through_date, status
  ) values (
    import_record.user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email,
    import_record.current_rent, rent_state.pending_amount, rent_state.total_paid,
    rent_state.rent_status, import_record.move_in_date, rent_state.current_rent_due_date,
    rent_state.current_rent_cycle_paid, rent_state.paid_through_date, 'active'
  ) returning id into new_tenant_id;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.existing_tenant_imports
  set status = 'approved',
      tenant_id = new_tenant_id,
      current_rent_due_date = rent_state.current_rent_due_date,
      current_rent_cycle_paid = rent_state.current_rent_cycle_paid,
      paid_through_date = rent_state.paid_through_date,
      rejection_reason = null,
      processed_at = now(),
      processed_by = auth.uid(),
      updated_at = now()
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
    import_record.current_rent_due_date,
    import_record.current_rent_cycle_paid,
    import_record.current_rent,
    current_date,
    import_record.paid_through_date
  );

  insert into public.tenants(user_id, property_id, room_id, name, phone, email, blood_group, rent_amount, pending_amount, total_paid, rent_status, move_in_date, current_rent_due_date, current_rent_cycle_paid, paid_through_date, status, profile_photo_path)
  values (
    effective_user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email, import_record.blood_group,
    import_record.current_rent, rent_state.pending_amount, rent_state.total_paid, rent_state.rent_status, import_record.move_in_date,
    rent_state.current_rent_due_date, rent_state.current_rent_cycle_paid, rent_state.paid_through_date, 'active',
    case
      when import_record.profile_photo like import_record.property_id::text || '/imports/photos/%'
        and import_record.profile_photo !~ '(^/|\\.\\.|//|[?#])'
      then import_record.profile_photo
      else null
    end
  )
  returning id into new_tenant_id;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1, status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end, updated_at = now() where id = room_record.id;
  update public.existing_tenant_imports
  set status = 'approved',
      user_id = effective_user_id,
      tenant_id = new_tenant_id,
      current_rent_due_date = rent_state.current_rent_due_date,
      current_rent_cycle_paid = rent_state.current_rent_cycle_paid,
      paid_through_date = rent_state.paid_through_date,
      rejection_reason = null,
      processed_at = now(),
      processed_by = auth.uid(),
      updated_at = now()
  where id = import_record.id;
  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

revoke all on function public.calculate_import_current_rent_due_date(date, date) from public, anon, authenticated;
revoke all on function public.calculate_import_previous_rent_due_date(date, date) from public, anon, authenticated;
revoke all on function public.calculate_imported_tenant_initial_rent_state(date, date, boolean, numeric, date, date) from public, anon, authenticated;
revoke all on function public.update_existing_tenant_import_rent_answer(uuid, boolean) from public, anon;
revoke all on function public.approve_existing_tenant_import(uuid) from public, anon;
revoke all on function public.approve_existing_tenant_import_with_user(uuid, uuid) from public, anon;
grant execute on function public.update_existing_tenant_import_rent_answer(uuid, boolean) to authenticated;
grant execute on function public.approve_existing_tenant_import(uuid) to authenticated;
grant execute on function public.approve_existing_tenant_import_with_user(uuid, uuid) to authenticated;
