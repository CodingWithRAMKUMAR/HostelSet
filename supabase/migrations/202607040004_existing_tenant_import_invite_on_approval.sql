-- Existing Tenant Import should not create/invite Auth users during public
-- submission. Pending imports can exist without a user_id until owner approval.

alter table public.existing_tenant_imports
  alter column user_id drop not null;

create or replace function public.approve_existing_tenant_import_with_user(
  p_import_id uuid,
  p_user_id uuid
)
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
begin
  if p_user_id is null then raise exception 'Tenant account is missing'; end if;

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

  effective_user_id := coalesce(import_record.user_id, p_user_id);

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
        tenant.user_id = effective_user_id
        or tenant.phone = import_record.phone
        or lower(tenant.email) = lower(import_record.email)
      )
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Tenant already exists for this property'; end if;

  insert into public.tenants(
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status
  ) values (
    effective_user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email,
    import_record.current_rent, 0, 0, 'paid', import_record.move_in_date, 'active'
  ) returning id into new_tenant_id;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.existing_tenant_imports
  set status = 'approved', user_id = effective_user_id, tenant_id = new_tenant_id,
      rejection_reason = null, processed_at = now(), processed_by = auth.uid(), updated_at = now()
  where id = import_record.id;

  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

revoke all on function public.approve_existing_tenant_import_with_user(uuid, uuid) from public, anon;
grant execute on function public.approve_existing_tenant_import_with_user(uuid, uuid) to authenticated;
