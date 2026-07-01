-- Atomic owner actions for manual rent collection and safe tenant archival.

create or replace function public.record_owner_rent_collection(
  p_tenant_id uuid,
  p_amount numeric,
  p_collection_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  property_owner uuid;
  new_pending numeric;
begin
  if p_collection_id is null then raise exception 'Collection ID is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Collection amount must be greater than zero'; end if;

  select * into tenant_record from public.tenants where id = p_tenant_id for update;
  if tenant_record.id is null then raise exception 'Tenant not found'; end if;
  if tenant_record.status not in ('active','notice_period','payment_pending') then raise exception 'Tenant is not active'; end if;

  select owner_id into property_owner from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized to collect rent for this tenant';
  end if;

  if exists (select 1 from public.payment_history where id = p_collection_id) then
    if exists (
      select 1 from public.payment_history
      where id = p_collection_id
        and tenant_id = tenant_record.id
        and payment_method = 'owner_collection'
        and status = 'success'
    ) then
      return jsonb_build_object('success', true, 'duplicate', true);
    end if;
    raise exception 'Collection ID has already been used';
  end if;

  new_pending := greatest(0, coalesce(tenant_record.pending_amount, 0) - p_amount);
  insert into public.payment_history (
    id, tenant_id, amount, payment_date, payment_method, status
  ) values (
    p_collection_id, tenant_record.id, p_amount, current_date, 'owner_collection', 'success'
  );

  update public.tenants
  set total_paid = coalesce(total_paid, 0) + p_amount,
      pending_amount = new_pending,
      rent_status = case when new_pending <= 0 then 'paid' else 'pending' end,
      last_payment_date = current_date,
      updated_at = now()
  where id = tenant_record.id;

  return jsonb_build_object('success', true, 'duplicate', false, 'pending_amount', new_pending);
end;
$$;

revoke all on function public.record_owner_rent_collection(uuid,numeric,uuid) from public,anon;
grant execute on function public.record_owner_rent_collection(uuid,numeric,uuid) to authenticated;

create or replace function public.archive_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  new_occupants integer;
begin
  select * into tenant_record from public.tenants where id = p_tenant_id for update;
  if tenant_record.id is null then raise exception 'Tenant not found'; end if;

  select owner_id into property_owner from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized to archive this tenant';
  end if;

  if tenant_record.status = 'inactive' then
    return jsonb_build_object('success', true, 'duplicate', true);
  end if;

  select * into room_record from public.rooms where id = tenant_record.room_id for update;
  if room_record.id is null then raise exception 'Tenant room not found'; end if;
  new_occupants := greatest(0, coalesce(room_record.current_occupants, 0) - 1);

  update public.tenants
  set status = 'inactive',
      check_out_requested = false,
      notice_period_start = null,
      notice_period_end = null,
      updated_at = now()
  where id = tenant_record.id;

  update public.rooms
  set current_occupants = new_occupants,
      status = 'vacant',
      updated_at = now()
  where id = room_record.id;

  update public.room_change_requests
  set status = 'rejected',
      rejection_reason = coalesce(rejection_reason, 'Tenant archived'),
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where tenant_id = tenant_record.id and status = 'pending';

  update public.check_out_requests
  set status = 'cancelled',
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where tenant_id = tenant_record.id and status = 'pending';

  update public.rent_records
  set status = 'cancelled', updated_at = now()
  where tenant_id = tenant_record.id and status = 'unpaid';

  return jsonb_build_object('success', true, 'duplicate', false, 'room_id', room_record.id);
end;
$$;

revoke all on function public.archive_tenant(uuid) from public,anon;
grant execute on function public.archive_tenant(uuid) to authenticated;
