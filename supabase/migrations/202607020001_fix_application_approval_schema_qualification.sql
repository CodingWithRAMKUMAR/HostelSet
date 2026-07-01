-- Fix application approval when search_path is empty by fully qualifying public table names.
create or replace function public.approve_application_atomic(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  tenant_id uuid;
begin
  select * into application_record from public.applications
  where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;

  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record from public.rooms where id = application_record.room_id for update;
  if room_record.id is null or room_record.property_id <> application_record.property_id then
    raise exception 'Room not found';
  end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then
    raise exception 'The selected room is full';
  end if;
  if application_record.user_id is null then raise exception 'Applicant account is missing'; end if;

  if exists (
    select 1 from public.tenants
    where property_id = application_record.property_id
      and (user_id = application_record.user_id or phone = application_record.phone)
      and status in ('active', 'payment_pending')
  ) then
    raise exception 'Applicant already has a tenant record';
  end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id
  ) values (
    application_record.user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id
  ) returning id into tenant_id;

  if coalesce(application_record.payment_amount, 0) > 0 then
    insert into public.payment_history (
      tenant_id, amount, payment_date, payment_method, status,
      upi_transaction_id, payment_screenshot
    ) values (
      tenant_id, application_record.payment_amount, current_date, 'advance',
      'payment_pending', application_record.payment_transaction_id, application_record.payment_screenshot
    );
  end if;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end
  where id = room_record.id;

  update public.applications set status = 'approved', processed_at = now() where id = application_record.id;

  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
end;
$$;

grant execute on function public.approve_application_atomic(uuid) to authenticated;
