-- Repair the application-deposit and reserved-room regressions introduced by
-- the 2026-07-17 workflow migrations. This migration is forward-only.

-- An owner approval verifies the application payment proof. The security
-- deposit is therefore successful immediately; monthly rent remains separate.
create or replace function public.approve_application_atomic(
  p_application_id uuid,
  p_user_id uuid
)
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
  if application_record.payment_screenshot is null
    or nullif(trim(application_record.payment_transaction_id), '') is null
  then
    raise exception 'Application payment proof is required';
  end if;

  select owner_id into property_owner
  from public.properties
  where id = application_record.property_id;

  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record
  from public.rooms
  where id = application_record.room_id
    and property_id = application_record.property_id
  for update;

  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then
    raise exception 'The selected room is full';
  end if;

  deposit_amount := greatest(
    0,
    coalesce(application_record.payment_amount, room_record.deposit_amount, 0)
  );
  if deposit_amount <= 0 then raise exception 'Application deposit amount is invalid'; end if;

  if exists (
    select 1
    from public.tenants tenant
    where tenant.property_id = application_record.property_id
      and (
        tenant.user_id = p_user_id
        or tenant.phone = application_record.phone
        or lower(tenant.email) = lower(application_record.email)
      )
      and tenant.status in ('active', 'notice_period', 'payment_pending')
  ) then
    raise exception 'Applicant already has a tenant record';
  end if;

  insert into public.tenants (
    user_id,
    property_id,
    room_id,
    name,
    phone,
    email,
    blood_group,
    rent_amount,
    pending_amount,
    total_paid,
    rent_status,
    move_in_date,
    status,
    payment_screenshot,
    upi_transaction_id,
    security_deposit_amount,
    security_deposit_status,
    security_deposit_refund_status,
    profile_photo_path
  ) values (
    p_user_id,
    application_record.property_id,
    application_record.room_id,
    application_record.name,
    application_record.phone,
    application_record.email,
    application_record.blood_group,
    room_record.monthly_rent,
    room_record.monthly_rent,
    0,
    'pending',
    current_date,
    'active',
    application_record.payment_screenshot,
    application_record.payment_transaction_id,
    deposit_amount,
    'paid',
    'not_refunded',
    case
      when application_record.photo like application_record.property_id::text || '/photos/%'
        and application_record.photo !~ '(^/|\\.\\.|//|[?#])'
      then application_record.photo
      else null
    end
  )
  returning id into tenant_id;

  insert into public.payment_history (
    tenant_id,
    amount,
    payment_date,
    payment_method,
    status,
    upi_transaction_id,
    payment_screenshot
  ) values (
    tenant_id,
    deposit_amount,
    current_date,
    'security_deposit',
    'success',
    application_record.payment_transaction_id,
    application_record.payment_screenshot
  );

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case
        when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied'
        else 'vacant'
      end,
      updated_at = now()
  where id = room_record.id;

  update public.applications
  set status = 'approved',
      user_id = p_user_id,
      processed_at = now(),
      updated_at = now()
  where id = application_record.id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', tenant_id,
    'email', application_record.email
  );
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

revoke all on function public.approve_application_atomic(uuid, uuid) from public, anon;
revoke all on function public.approve_application_atomic(uuid) from public, anon;
grant execute on function public.approve_application_atomic(uuid, uuid) to authenticated;
grant execute on function public.approve_application_atomic(uuid) to authenticated;

-- Repair deposits created by the regressed approval function. Matching on the
-- application UPI transaction keeps this backfill narrow and idempotent.
with matched_deposits as (
  select distinct payment.id as payment_id
  from public.applications application
  join public.tenants tenant
    on tenant.user_id = application.user_id
   and tenant.property_id = application.property_id
   and tenant.room_id = application.room_id
   and lower(tenant.email) = lower(application.email)
  join public.payment_history payment
    on payment.tenant_id = tenant.id
   and payment.payment_method = 'security_deposit'
   and payment.status = 'payment_pending'
   and payment.upi_transaction_id = application.payment_transaction_id
  where application.status = 'approved'
    and nullif(trim(application.payment_transaction_id), '') is not null
)
update public.payment_history payment
set status = 'success'
from matched_deposits matched
where payment.id = matched.payment_id;

update public.tenants tenant
set security_deposit_status = 'paid',
    security_deposit_amount = greatest(
      coalesce(tenant.security_deposit_amount, 0),
      coalesce(deposit.amount, 0)
    ),
    updated_at = now()
from (
  select payment.tenant_id, max(payment.amount) as amount
  from public.payment_history payment
  where payment.payment_method = 'security_deposit'
    and payment.status = 'success'
  group by payment.tenant_id
) deposit
where tenant.id = deposit.tenant_id
  and tenant.security_deposit_status is distinct from 'paid';

-- Only another monthly-rent proof should block a new monthly-rent proof.
-- Security deposits, pre-bookings and application fees are separate ledgers.
create or replace function public.enforce_tenant_pending_payment_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_user_id uuid;
begin
  select user_id into tenant_user_id
  from public.tenants
  where id = new.tenant_id
  for update;

  if tenant_user_id = auth.uid() and new.status = 'payment_pending' then
    if nullif(trim(new.upi_transaction_id), '') is null then
      raise exception 'UPI transaction ID is required';
    end if;
    if nullif(trim(new.payment_screenshot), '') is null then
      raise exception 'Payment screenshot is required';
    end if;

    if exists (
      select 1
      from public.payment_history payment
      where payment.tenant_id = new.tenant_id
        and payment.status = 'payment_pending'
        and lower(coalesce(payment.payment_method, '')) not in (
          'security_deposit',
          'deposit',
          'pre_booking',
          'joining_fee',
          'application_fee'
        )
    ) then
      raise exception 'A rent payment proof is already waiting for owner confirmation.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_tenant_pending_payment_submission()
  from public, anon, authenticated;

-- A vacate date is public only while its tenant is still on notice. This also
-- prevents an approved request from remaining visible after an early archive.
create or replace function public.refresh_room_public_availability(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_room_id is null then return; end if;

  update public.rooms room
  set next_vacate_date = (
        select min(request.expected_check_out)
        from public.check_out_requests request
        join public.tenants tenant
          on tenant.id = request.tenant_id
         and tenant.room_id = request.room_id
        where request.room_id = p_room_id
          and request.status = 'approved'
          and request.expected_check_out >= (now() at time zone 'Asia/Kolkata')::date
          and tenant.status = 'notice_period'
          and coalesce(tenant.check_out_requested, false)
      ),
      has_approved_prebooking = exists (
        select 1
        from public.pre_bookings booking
        where booking.room_id = p_room_id
          and booking.status = 'reserved'
          and booking.deleted_at is null
      )
  where room.id = p_room_id;
end;
$$;

-- Tenant archival changes the meaning of an approved checkout even when the
-- checkout row itself does not change. Refresh both the old and new rooms.
create or replace function public.sync_tenant_room_public_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_room_public_availability(new.room_id);

  if old.room_id is distinct from new.room_id then
    perform public.refresh_room_public_availability(old.room_id);
  end if;

  return new;
end;
$$;

revoke all on function public.sync_tenant_room_public_availability()
  from public, anon, authenticated;

drop trigger if exists tenants_public_availability_refresh on public.tenants;
create trigger tenants_public_availability_refresh
after update of status, room_id, check_out_requested on public.tenants
for each row
when (
  old.status is distinct from new.status
  or old.room_id is distinct from new.room_id
  or old.check_out_requested is distinct from new.check_out_requested
)
execute function public.sync_tenant_room_public_availability();

-- Close future approved vacate requests whose tenant was already archived.
update public.check_out_requests request
set status = 'cancelled',
    processed_at = coalesce(request.processed_at, now()),
    updated_at = now()
where request.status = 'approved'
  and request.expected_check_out > (now() at time zone 'Asia/Kolkata')::date
  and not exists (
    select 1
    from public.tenants tenant
    where tenant.id = request.tenant_id
      and tenant.room_id = request.room_id
      and tenant.status = 'notice_period'
      and coalesce(tenant.check_out_requested, false)
  );

do $$
declare
  room_record record;
begin
  for room_record in select id from public.rooms loop
    perform public.refresh_room_public_availability(room_record.id);
  end loop;
end;
$$;

-- Public property cards must subtract reserved beds from immediately available
-- beds and must not advertise a reserved future vacancy as pre-bookable.
create or replace function public.get_public_property_availability_rows()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  city text,
  address text,
  formatted_address text,
  pincode text,
  property_type text,
  amenities text[],
  photos text[],
  contact_number text,
  latitude double precision,
  longitude double precision,
  location_verified boolean,
  active_tenant_count integer,
  total_rooms integer,
  available_room_count integer,
  reserved_room_count integer,
  upcoming_vacate_room_count integer,
  total_capacity integer,
  current_occupants integer,
  lowest_rent numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with public_rooms as (
    select
      room.id,
      room.property_id,
      room.capacity,
      room.current_occupants,
      room.monthly_rent,
      room.next_vacate_date
    from public.rooms room
    where room.status in ('vacant', 'occupied')
      and room.capacity > 0
  ),
  reserved_prebookings as (
    select booking.room_id, count(*)::integer as reserved_beds
    from public.pre_bookings booking
    where booking.status = 'reserved'
      and booking.deleted_at is null
    group by booking.room_id
  ),
  room_availability as (
    select
      room.property_id,
      room.id,
      room.capacity,
      room.current_occupants,
      room.monthly_rent,
      room.next_vacate_date,
      coalesce(reservation.reserved_beds, 0)::integer as reserved_beds,
      greatest(
        0,
        room.capacity
          - coalesce(room.current_occupants, 0)
          - coalesce(reservation.reserved_beds, 0)
      )::integer as available_beds_now
    from public_rooms room
    left join reserved_prebookings reservation
      on reservation.room_id = room.id
  ),
  room_stats as (
    select
      room.property_id,
      count(*)::integer as total_rooms,
      count(*) filter (where room.available_beds_now > 0)::integer as available_room_count,
      count(*) filter (where room.reserved_beds > 0)::integer as reserved_room_count,
      count(*) filter (
        where room.next_vacate_date is not null
          and room.next_vacate_date >= current_date
          and room.reserved_beds = 0
      )::integer as upcoming_vacate_room_count,
      coalesce(sum(room.capacity), 0)::integer as total_capacity,
      coalesce(sum(room.current_occupants), 0)::integer as current_occupants,
      min(room.monthly_rent) as lowest_rent
    from room_availability room
    group by room.property_id
  ),
  tenant_stats as (
    select tenant.property_id, count(*)::integer as active_tenant_count
    from public.tenants tenant
    where tenant.status in ('active', 'notice_period', 'payment_pending')
    group by tenant.property_id
  )
  select
    property.id,
    property.slug,
    property.name,
    property.description,
    property.city,
    property.address,
    property.formatted_address,
    property.pincode,
    property.property_type,
    property.amenities,
    property.photos,
    property.contact_number,
    property.latitude,
    property.longitude,
    property.location_verified,
    coalesce(tenant_stats.active_tenant_count, 0),
    coalesce(room_stats.total_rooms, 0),
    coalesce(room_stats.available_room_count, 0),
    coalesce(room_stats.reserved_room_count, 0),
    coalesce(room_stats.upcoming_vacate_room_count, 0),
    coalesce(room_stats.total_capacity, 0),
    coalesce(room_stats.current_occupants, 0),
    room_stats.lowest_rent,
    property.created_at,
    property.updated_at
  from public.properties property
  left join tenant_stats on tenant_stats.property_id = property.id
  left join room_stats on room_stats.property_id = property.id
  where property.is_active = true
    and coalesce(property.lifecycle_status, 'active') = 'active'
    and property.archived_at is null
    and coalesce(room_stats.total_rooms, 0) > 0
  order by property.created_at desc;
$$;

revoke all on function public.get_public_property_availability_rows()
  from public, anon, authenticated;

-- Enforce the same reservation capacity on the server, not only in the UI.
create or replace function public.reserve_prebooking_atomic(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.pre_bookings%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  actor_id uuid := auth.uid();
  paid numeric;
  active_reservations integer;
  reservation_limit integer;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;

  select * into booking
  from public.pre_bookings
  where id = p_booking_id;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;

  select owner_id into property_owner
  from public.properties
  where id = booking.property_id;
  if property_owner is distinct from actor_id and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record
  from public.rooms
  where id = booking.room_id
    and property_id = booking.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;

  reservation_limit := greatest(
    greatest(0, coalesce(room_record.capacity, 0) - coalesce(room_record.current_occupants, 0)),
    case
      when exists (
        select 1
        from public.check_out_requests request
        join public.tenants tenant
          on tenant.id = request.tenant_id
         and tenant.room_id = request.room_id
        where request.room_id = room_record.id
          and request.status = 'approved'
          and request.expected_check_out >= (now() at time zone 'Asia/Kolkata')::date
          and tenant.status = 'notice_period'
          and coalesce(tenant.check_out_requested, false)
      ) then 1
      else 0
    end
  );

  if reservation_limit <= 0 then
    raise exception 'This room has no reservable vacancy';
  end if;

  select count(*)::integer into active_reservations
  from public.pre_bookings other_booking
  where other_booking.room_id = room_record.id
    and other_booking.status = 'reserved'
    and other_booking.deleted_at is null;

  if active_reservations >= reservation_limit then
    raise exception 'The available vacancy is already reserved';
  end if;

  select * into booking
  from public.pre_bookings
  where id = p_booking_id
  for update;

  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  if booking.deleted_at is not null then raise exception 'Pre-booking has been removed'; end if;
  if booking.room_id is distinct from room_record.id
    or booking.property_id is distinct from room_record.property_id
  then
    raise exception 'Pre-booking room changed during reservation';
  end if;
  if booking.payment_screenshot is null
    or nullif(trim(booking.payment_transaction_id), '') is null
  then
    raise exception 'Payment proof is required';
  end if;

  paid := greatest(0, coalesce(booking.pre_booking_fee_amount, 0));
  if paid <= 0 then raise exception 'Pre-booking fee amount is invalid'; end if;

  update public.pre_bookings
  set status = 'reserved',
      reserved_at = now(),
      reserved_by = actor_id,
      updated_at = now()
  where id = booking.id;

  perform public.refresh_room_public_availability(room_record.id);

  return jsonb_build_object(
    'success', true,
    'status', 'reserved',
    'booking_id', booking.id,
    'room_id', room_record.id,
    'email', booking.email,
    'name', booking.name,
    'amount', paid,
    'active_reservations', active_reservations + 1,
    'reservation_limit', reservation_limit,
    'capacity', room_record.capacity
  );
end;
$$;

revoke all on function public.reserve_prebooking_atomic(uuid) from public, anon;
grant execute on function public.reserve_prebooking_atomic(uuid) to authenticated;
