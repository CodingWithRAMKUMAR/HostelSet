-- Canonical prebooking/application approval repair.
-- This is forward-only and intentionally does not edit applied migrations.

alter table public.owner_settings
  alter column pre_booking_fee set default 3000;

update public.owner_settings
set pre_booking_fee = 3000,
    updated_at = now()
where coalesce(pre_booking_fee, 0) <= 0;

alter table public.owner_settings
  drop constraint if exists owner_settings_pre_booking_fee_positive;
alter table public.owner_settings
  add constraint owner_settings_pre_booking_fee_positive
  check (pre_booking_fee > 0);

create unique index if not exists tenants_one_active_user_per_property_uidx
  on public.tenants(property_id, user_id)
  where user_id is not null and status in ('active','notice_period','payment_pending');

create unique index if not exists tenants_one_active_phone_per_property_uidx
  on public.tenants(property_id, phone)
  where phone is not null and status in ('active','notice_period','payment_pending');

create unique index if not exists tenants_one_active_email_per_property_uidx
  on public.tenants(property_id, lower(email))
  where email is not null and status in ('active','notice_period','payment_pending');

create unique index if not exists payment_history_one_transaction_per_tenant_method_uidx
  on public.payment_history(tenant_id, payment_method, upi_transaction_id)
  where upi_transaction_id is not null;

create or replace function public.approve_application_atomic(p_application_id uuid, p_user_id uuid)
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
  deposit_amount numeric;
begin
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  select * into application_record
  from public.applications
  where id = p_application_id
  for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;

  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record
  from public.rooms
  where id = application_record.room_id and property_id = application_record.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;

  deposit_amount := greatest(0, coalesce(application_record.payment_amount, room_record.deposit_amount, 0));
  if deposit_amount <= 0 then raise exception 'Application deposit amount is invalid'; end if;

  if exists (
    select 1 from public.tenants tenant
    where tenant.property_id = application_record.property_id
      and (
        tenant.user_id = p_user_id
        or tenant.phone = application_record.phone
        or lower(tenant.email) = lower(application_record.email)
      )
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, blood_group, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id,
    security_deposit_amount, security_deposit_status, security_deposit_refund_status,
    profile_photo_path
  ) values (
    p_user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email, application_record.blood_group,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id,
    deposit_amount, 'pending', 'not_refunded',
    case
      when application_record.photo like application_record.property_id::text || '/photos/%'
        and application_record.photo !~ '(^/|\\.\\.|//|[?#])'
      then application_record.photo
      else null
    end
  ) returning id into tenant_id;

  insert into public.payment_history (
    tenant_id, amount, payment_date, payment_method, status,
    upi_transaction_id, payment_screenshot
  ) values (
    tenant_id, deposit_amount, current_date, 'security_deposit', 'payment_pending',
    application_record.payment_transaction_id, application_record.payment_screenshot
  );

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.applications
  set status = 'approved',
      user_id = p_user_id,
      processed_at = now(),
      updated_at = now()
  where id = application_record.id;

  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
end;
$$;

create or replace function public.approve_application_atomic(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
begin
  select * into application_record
  from public.applications
  where id = p_application_id;
  if application_record.id is null then raise exception 'Application not found'; end if;
  return public.approve_application_atomic(p_application_id, application_record.user_id);
end;
$$;

create or replace function public.approve_prebooking_atomic(p_booking_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.pre_bookings%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  tenant_id uuid;
  paid numeric;
begin
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  select * into booking
  from public.pre_bookings
  where id = p_booking_id
  for update;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  if booking.payment_screenshot is null or nullif(trim(booking.payment_transaction_id), '') is null then
    raise exception 'Payment proof is required';
  end if;

  select owner_id into property_owner from public.properties where id = booking.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;

  select * into room_record
  from public.rooms
  where id = booking.room_id and property_id = booking.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;

  paid := greatest(0, coalesce(booking.pre_booking_fee_amount, 0));
  if paid <= 0 then raise exception 'Pre-booking fee amount is invalid'; end if;

  if exists (
    select 1 from public.tenants tenant
    where tenant.property_id = booking.property_id
      and (
        tenant.user_id = p_user_id
        or tenant.phone = booking.phone
        or lower(tenant.email) = lower(booking.email)
      )
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status, profile_photo_path
  ) values (
    p_user_id, booking.property_id, booking.room_id, booking.name, booking.phone, booking.email,
    room_record.monthly_rent, greatest(0, room_record.monthly_rent - paid), paid,
    case when room_record.monthly_rent <= paid then 'paid' else 'pending' end,
    booking.expected_move_in_date, 'active',
    case
      when booking.photo like booking.property_id::text || '/photos/%'
        and booking.photo !~ '(^/|\\.\\.|//|[?#])'
      then booking.photo
      else null
    end
  ) returning id into tenant_id;

  insert into public.payment_history (
    tenant_id, amount, payment_date, payment_method, status,
    upi_transaction_id, payment_screenshot
  ) values (
    tenant_id, paid, current_date, 'pre_booking', 'success',
    booking.payment_transaction_id, booking.payment_screenshot
  );

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.pre_bookings
  set status = 'approved',
      user_id = p_user_id,
      updated_at = now()
  where id = booking.id;

  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', booking.email);
end;
$$;

create or replace function public.reject_application(
  p_application_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  property_owner uuid;
begin
  select * into application_record from public.applications where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if application_record.status = 'rejected' then return jsonb_build_object('success', true, 'status', 'rejected'); end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;
  if length(coalesce(p_reason, '')) > 1000 then raise exception 'Rejection reason is too long'; end if;

  update public.applications
  set status = 'rejected',
      processed_at = now(),
      updated_at = now()
  where id = application_record.id;
  return jsonb_build_object('success', true, 'status', 'rejected');
end;
$$;

create or replace function public.reject_prebooking(
  p_booking_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.pre_bookings%rowtype;
  property_owner uuid;
begin
  select * into booking from public.pre_bookings where id = p_booking_id for update;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  select owner_id into property_owner from public.properties where id = booking.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if booking.status = 'rejected' then return jsonb_build_object('success', true, 'status', 'rejected'); end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  if length(coalesce(p_reason, '')) > 1000 then raise exception 'Rejection reason is too long'; end if;

  update public.pre_bookings
  set status = 'rejected',
      updated_at = now()
  where id = booking.id;
  return jsonb_build_object('success', true, 'status', 'rejected');
end;
$$;

revoke all on function public.approve_application_atomic(uuid, uuid) from public, anon;
revoke all on function public.approve_application_atomic(uuid) from public, anon;
revoke all on function public.approve_prebooking_atomic(uuid, uuid) from public, anon;
revoke all on function public.reject_application(uuid, text) from public, anon;
revoke all on function public.reject_prebooking(uuid, text) from public, anon;
grant execute on function public.approve_application_atomic(uuid, uuid) to authenticated;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
grant execute on function public.approve_prebooking_atomic(uuid, uuid) to authenticated;
grant execute on function public.reject_application(uuid, text) to authenticated;
grant execute on function public.reject_prebooking(uuid, text) to authenticated;
