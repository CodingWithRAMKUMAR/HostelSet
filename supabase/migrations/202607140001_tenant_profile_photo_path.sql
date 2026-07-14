-- Canonical private profile photo path for tenant avatars.
-- Identity/Aadhaar/supporting documents remain separate and must not be used
-- as profile photos.
alter table public.tenants
  add column if not exists profile_photo_path text;

alter table public.tenants drop constraint if exists tenants_profile_photo_path_private_check;
alter table public.tenants add constraint tenants_profile_photo_path_private_check
  check (
      profile_photo_path is null
    or (
      profile_photo_path !~ '(^/|\\.\\.|//|[?#])'
      and profile_photo_path !~* '(^|/)(identity|id-proof|aadhaar|aadhar|payments)(/|$)'
      and profile_photo_path ~ '/(profile-photos|photos)/'
    )
  );

create index if not exists tenants_profile_photo_path_idx
  on public.tenants(profile_photo_path)
  where profile_photo_path is not null;

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
  select * into application_record from public.applications where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;
  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  select * into room_record from public.rooms where id = application_record.room_id for update;
  if room_record.id is null or room_record.property_id <> application_record.property_id then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if application_record.user_id is null then raise exception 'Applicant account is missing'; end if;
  if exists (select 1 from public.tenants where property_id = application_record.property_id and (user_id = application_record.user_id or phone = application_record.phone) and status in ('active', 'payment_pending')) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, blood_group, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id,
    security_deposit_amount, security_deposit_status, security_deposit_refund_status,
    profile_photo_path
  ) values (
    application_record.user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email, application_record.blood_group,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id,
    greatest(0, coalesce(application_record.payment_amount, 0)),
    case when coalesce(application_record.payment_amount, 0) > 0 then 'pending' else 'not_required' end,
    'not_refunded',
    case
      when application_record.photo like application_record.property_id::text || '/photos/%'
        and application_record.photo !~ '(^/|\\.\\.|//|[?#])'
      then application_record.photo
      else null
    end
  ) returning id into tenant_id;
  if coalesce(application_record.payment_amount, 0) > 0 then
    insert into public.payment_history (tenant_id, amount, payment_date, payment_method, status, upi_transaction_id, payment_screenshot)
    values (tenant_id, application_record.payment_amount, current_date, 'security_deposit', 'payment_pending', application_record.payment_transaction_id, application_record.payment_screenshot);
  end if;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1, status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end where id = room_record.id;
  update public.applications set status = 'approved', processed_at = now() where id = application_record.id;
  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
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
  select * into booking from public.pre_bookings where id = p_booking_id for update;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  select owner_id into property_owner from public.properties where id = booking.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  select * into room_record from public.rooms where id = booking.room_id for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  paid := greatest(0, coalesce(booking.pre_booking_fee_amount, 0));
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

  if paid > 0 then
    insert into public.payment_history (
      tenant_id, amount, payment_date, payment_method, status,
      upi_transaction_id, payment_screenshot
    ) values (
      tenant_id, paid, current_date, 'pre_booking', 'success',
      booking.payment_transaction_id, booking.payment_screenshot
    );
  end if;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1,
    status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end
  where id = room_record.id;
  update public.pre_bookings set status = 'approved', user_id = p_user_id, updated_at = now() where id = booking.id;
  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', booking.email);
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
  insert into public.tenants(user_id, property_id, room_id, name, phone, email, blood_group, rent_amount, pending_amount, total_paid, rent_status, move_in_date, status, profile_photo_path)
  values (
    effective_user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email, import_record.blood_group,
    import_record.current_rent, 0, 0, 'paid', import_record.move_in_date, 'active',
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

revoke all on function public.approve_application_atomic(uuid) from public, anon;
revoke all on function public.approve_prebooking_atomic(uuid, uuid) from public, anon;
revoke all on function public.approve_existing_tenant_import_with_user(uuid, uuid) from public, anon;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
grant execute on function public.approve_prebooking_atomic(uuid, uuid) to authenticated;
grant execute on function public.approve_existing_tenant_import_with_user(uuid, uuid) to authenticated;
