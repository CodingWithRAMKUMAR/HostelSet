-- Public availability should be driven by public-safe property and room state.
-- An approved property with active rooms can be browsed even before it has
-- active tenants. This function set intentionally keeps the public contract
-- that already exposed address, formatted_address, contact_number, and exact
-- coordinates through get_public_properties/get_public_properties_v2.
--
-- Security-definer owner expectation: own these functions by the normal
-- migration/app owner role, not by an end-user role. All references are schema
-- qualified, search_path is empty, and no dynamic SQL is used.

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
      has_approved_prebooking = exists (
        select 1
        from public.pre_bookings booking
        where booking.room_id = p_room_id
          and booking.status = 'approved'
          and booking.deleted_at is null
          and not exists (
            select 1
            from public.tenants tenant
            where tenant.property_id = booking.property_id
              and tenant.room_id = booking.room_id
              and tenant.status in ('active', 'notice_period', 'payment_pending')
              and booking.user_id is not null
              and tenant.user_id = booking.user_id
          )
      )
  where room.id = p_room_id;
end;
$$;

-- Reconcile the public-safe room flags once after tightening the reservation
-- definition. Converted approved prebookings are represented by
-- rooms.current_occupants and must not leave rooms.has_approved_prebooking
-- permanently true.
update public.rooms room
set next_vacate_date = (
      select min(request.expected_check_out)
      from public.check_out_requests request
      where request.room_id = room.id and request.status = 'approved'
    ),
    has_approved_prebooking = exists (
      select 1
      from public.pre_bookings booking
      where booking.room_id = room.id
        and booking.status = 'approved'
        and booking.deleted_at is null
        and not exists (
          select 1
          from public.tenants tenant
          where tenant.property_id = booking.property_id
            and tenant.room_id = booking.room_id
            and tenant.status in ('active', 'notice_period', 'payment_pending')
            and booking.user_id is not null
            and tenant.user_id = booking.user_id
        )
    );

create or replace function public.is_public_property_visible(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.is_active = true
      and coalesce(property.lifecycle_status, 'active') = 'active'
      and property.archived_at is null
      and exists (
        select 1
        from public.rooms room
        where room.property_id = property.id
          and room.status in ('vacant', 'occupied')
          and room.capacity > 0
      )
  );
$$;

revoke all on function public.is_public_property_visible(uuid) from public, anon, authenticated;
grant execute on function public.is_public_property_visible(uuid) to anon, authenticated;

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
  approved_prebookings as (
    select
      booking.room_id,
      count(*)::integer as reserved_beds
    from public.pre_bookings booking
    where booking.status = 'approved'
      and booking.deleted_at is null
      and not exists (
        select 1
        from public.tenants tenant
        where tenant.property_id = booking.property_id
          and tenant.room_id = booking.room_id
          and tenant.status in ('active', 'notice_period', 'payment_pending')
          and booking.user_id is not null
          and tenant.user_id = booking.user_id
      )
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
        room.capacity - coalesce(room.current_occupants, 0) - coalesce(reservation.reserved_beds, 0)
      )::integer as available_beds_now
    from public_rooms room
    left join approved_prebookings reservation on reservation.room_id = room.id
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

create or replace function public.get_public_properties_v2()
returns table (
  id uuid, slug text, name text, description text, city text, address text,
  formatted_address text, pincode text, property_type text, amenities text[], photos text[],
  contact_number text, latitude double precision, longitude double precision,
  location_verified boolean, active_tenant_count integer, total_rooms integer,
  available_room_count integer, total_capacity integer, current_occupants integer,
  lowest_rent numeric, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    availability.id,
    availability.slug,
    availability.name,
    availability.description,
    availability.city,
    availability.address,
    availability.formatted_address,
    availability.pincode,
    availability.property_type,
    availability.amenities,
    availability.photos,
    availability.contact_number,
    availability.latitude,
    availability.longitude,
    availability.location_verified,
    availability.active_tenant_count,
    availability.total_rooms,
    availability.available_room_count,
    availability.total_capacity,
    availability.current_occupants,
    availability.lowest_rent,
    availability.created_at,
    availability.updated_at
  from public.get_public_property_availability_rows() availability;
$$;

revoke all on function public.get_public_properties_v2() from public, anon, authenticated;
grant execute on function public.get_public_properties_v2() to anon, authenticated;

create or replace function public.get_public_properties()
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
  select
    availability.id,
    availability.slug,
    availability.name,
    availability.description,
    availability.city,
    availability.address,
    availability.formatted_address,
    availability.pincode,
    availability.property_type,
    availability.amenities,
    availability.photos,
    availability.contact_number,
    availability.latitude,
    availability.longitude,
    availability.location_verified,
    availability.active_tenant_count,
    availability.total_rooms,
    availability.total_capacity,
    availability.current_occupants,
    availability.lowest_rent,
    availability.created_at,
    availability.updated_at
  from public.get_public_property_availability_rows() availability;
$$;

revoke all on function public.get_public_properties() from public, anon, authenticated;
grant execute on function public.get_public_properties() to anon, authenticated;
