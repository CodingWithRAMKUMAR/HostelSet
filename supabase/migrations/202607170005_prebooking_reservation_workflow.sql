-- Isolated two-stage pre-booking reservation workflow.
-- New approvals reserve the next vacancy only; tenant/account creation happens
-- later through explicit conversion after occupancy has actually been released.

alter table public.pre_bookings
  add column if not exists reserved_at timestamptz,
  add column if not exists reserved_by uuid references public.users(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.users(id) on delete set null,
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists reservation_email_sent_at timestamptz,
  add column if not exists conversion_invite_sent_at timestamptz;

alter table public.payment_history
  add column if not exists pre_booking_id uuid references public.pre_bookings(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'pre_bookings'
      and constraint_name = 'pre_bookings_status_check'
  ) then
    alter table public.pre_bookings drop constraint pre_bookings_status_check;
  end if;
end $$;

alter table public.pre_bookings
  add constraint pre_bookings_status_check
  check (status in ('pending','approved','rejected','reserved','converted','cancelled','refunded'));

drop index if exists public.prebookings_one_reserved_room_uidx;

create unique index if not exists payment_history_one_prebooking_payment_uidx
  on public.payment_history(pre_booking_id)
  where pre_booking_id is not null and payment_method = 'pre_booking';

create index if not exists prebookings_room_status_reserved_idx
  on public.pre_bookings(room_id, status, created_at desc)
  where deleted_at is null and status in ('pending','reserved','converted');

create index if not exists prebookings_reserved_room_order_idx
  on public.pre_bookings(room_id, reserved_at asc, created_at asc, id asc)
  where status = 'reserved' and deleted_at is null;

create index if not exists payment_history_pre_booking_id_idx
  on public.payment_history(pre_booking_id)
  where pre_booking_id is not null;

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
        where request.room_id = p_room_id and request.status = 'approved'
      ),
      has_approved_prebooking = (
        select count(*) > 0
        from public.pre_bookings booking
        where booking.room_id = p_room_id
          and booking.status = 'reserved'
          and booking.deleted_at is null
      )
  where room.id = p_room_id;
end;
$$;

update public.rooms room
set next_vacate_date = (
      select min(request.expected_check_out)
      from public.check_out_requests request
      where request.room_id = room.id and request.status = 'approved'
    ),
    has_approved_prebooking = (
      select count(*) > 0
      from public.pre_bookings booking
      where booking.room_id = room.id
        and booking.status = 'reserved'
        and booking.deleted_at is null
    );

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
    select room.id, room.property_id, room.capacity, room.current_occupants, room.monthly_rent, room.next_vacate_date
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
        room.capacity - coalesce(room.current_occupants, 0)
      )::integer as available_beds_now
    from public_rooms room
    left join reserved_prebookings reservation on reservation.room_id = room.id
  ),
  room_stats as (
    select
      room.property_id,
      count(*)::integer as total_rooms,
      count(*) filter (where room.available_beds_now > 0)::integer as available_room_count,
      count(*) filter (where room.reserved_beds > 0)::integer as reserved_room_count,
      count(*) filter (where room.next_vacate_date is not null and room.next_vacate_date >= current_date)::integer as upcoming_vacate_room_count,
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

revoke all on function public.get_public_property_availability_rows() from public, anon, authenticated;

create or replace function public.get_public_property_rooms(p_property_id uuid)
returns table (
  id uuid,
  property_id uuid,
  room_number text,
  sharing_type text,
  monthly_rent numeric,
  capacity integer,
  current_occupants integer,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  room_audience text,
  deposit_amount numeric,
  next_vacate_date date,
  has_approved_prebooking boolean,
  reserved_prebooking_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    room.id,
    room.property_id,
    room.room_number,
    room.sharing_type,
    room.monthly_rent,
    room.capacity,
    room.current_occupants,
    room.status,
    room.created_at,
    room.updated_at,
    room.room_audience,
    room.deposit_amount,
    room.next_vacate_date,
    exists (
      select 1
      from public.pre_bookings booking
      where booking.room_id = room.id
        and booking.status = 'reserved'
        and booking.deleted_at is null
    ) as has_approved_prebooking,
    (
      select count(*)::integer
      from public.pre_bookings booking
      where booking.room_id = room.id
        and booking.status = 'reserved'
        and booking.deleted_at is null
    ) as reserved_prebooking_count
  from public.rooms room
  where room.property_id = p_property_id
    and room.status in ('vacant', 'occupied')
    and room.capacity > 0
    and exists (
      select 1
      from public.properties property
      where property.id = room.property_id
        and property.is_active = true
        and coalesce(property.lifecycle_status, 'active') = 'active'
        and property.archived_at is null
    )
  order by room.room_number;
$$;

revoke all on function public.get_public_property_rooms(uuid) from public, anon, authenticated;
grant execute on function public.get_public_property_rooms(uuid) to anon, authenticated;

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
  where id = booking.room_id and property_id = booking.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;

  select count(*)::integer into active_reservations
  from public.pre_bookings other_booking
  where other_booking.room_id = room_record.id
    and other_booking.status = 'reserved'
    and other_booking.deleted_at is null;
  if active_reservations >= coalesce(room_record.capacity, 0) then
    raise exception 'This room has no remaining reservation capacity';
  end if;

  select * into booking
  from public.pre_bookings
  where id = p_booking_id
  for update;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  if booking.deleted_at is not null then raise exception 'Pre-booking has been removed'; end if;
  if booking.room_id is distinct from room_record.id or booking.property_id is distinct from room_record.property_id then
    raise exception 'Pre-booking room changed during reservation';
  end if;
  if booking.payment_screenshot is null or nullif(trim(booking.payment_transaction_id), '') is null then
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
    'capacity', room_record.capacity
  );
end;
$$;

create or replace function public.approve_prebooking_atomic(p_booking_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.reserve_prebooking_atomic(p_booking_id);
end;
$$;

create or replace function public.convert_reserved_prebooking_to_tenant(
  p_booking_id uuid,
  p_user_id uuid,
  p_converted_by uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.pre_bookings%rowtype;
  requested_booking public.pre_bookings%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  new_tenant_id uuid;
  paid numeric;
  actor_id uuid := coalesce(p_converted_by, auth.uid());
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  select * into requested_booking
  from public.pre_bookings
  where id = p_booking_id;
  if requested_booking.id is null then raise exception 'Pre-booking not found'; end if;
  if requested_booking.status = 'converted' then
    return jsonb_build_object(
      'success', true,
      'status', 'converted',
      'booking_id', requested_booking.id,
      'tenant_id', requested_booking.tenant_id,
      'email', requested_booking.email,
      'name', requested_booking.name,
      'already_converted', true
    );
  end if;
  if requested_booking.status <> 'reserved' then raise exception 'Pre-booking is not reserved'; end if;
  if requested_booking.deleted_at is not null then raise exception 'Pre-booking has been removed'; end if;

  select owner_id into property_owner
  from public.properties
  where id = requested_booking.property_id;
  if property_owner is distinct from actor_id and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record
  from public.rooms
  where id = requested_booking.room_id and property_id = requested_booking.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then
    raise exception 'The selected room is full';
  end if;

  select * into booking
  from public.pre_bookings reserved_booking
  where reserved_booking.room_id = room_record.id
    and reserved_booking.status = 'reserved'
    and reserved_booking.deleted_at is null
  order by reserved_booking.reserved_at asc nulls last, reserved_booking.created_at asc, reserved_booking.id asc
  limit 1
  for update;
  if booking.id is null then raise exception 'No active reserved pre-booking found'; end if;
  if booking.id is distinct from requested_booking.id then
    raise exception 'An earlier reserved pre-booking must be converted first';
  end if;

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
    greatest(current_date, coalesce(booking.expected_move_in_date, current_date)), 'active',
    case
      when booking.photo like booking.property_id::text || '/photos/%'
        and booking.photo !~ '(^/|\\.\\.|//|[?#])'
      then booking.photo
      else null
    end
  ) returning id into new_tenant_id;

  insert into public.payment_history (
    tenant_id, amount, payment_date, payment_method, status,
    upi_transaction_id, payment_screenshot, pre_booking_id
  ) values (
    new_tenant_id, paid, current_date, 'pre_booking', 'success',
    booking.payment_transaction_id, booking.payment_screenshot, booking.id
  );

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.pre_bookings
  set status = 'converted',
      user_id = p_user_id,
      tenant_id = new_tenant_id,
      converted_at = now(),
      converted_by = actor_id,
      updated_at = now()
  where id = booking.id;

  perform public.refresh_room_public_availability(room_record.id);

  return jsonb_build_object(
    'success', true,
    'status', 'converted',
    'booking_id', booking.id,
    'tenant_id', new_tenant_id,
    'room_id', room_record.id,
    'email', booking.email,
    'name', booking.name,
    'already_converted', false
  );
end;
$$;

revoke all on function public.reserve_prebooking_atomic(uuid) from public, anon;
revoke all on function public.approve_prebooking_atomic(uuid, uuid) from public, anon;
revoke all on function public.convert_reserved_prebooking_to_tenant(uuid, uuid, uuid) from public, anon;
grant execute on function public.reserve_prebooking_atomic(uuid) to authenticated;
grant execute on function public.approve_prebooking_atomic(uuid, uuid) to authenticated;
grant execute on function public.convert_reserved_prebooking_to_tenant(uuid, uuid, uuid) to authenticated;
