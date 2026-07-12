-- Public room availability uses room capacity; roommate contacts are scoped server-side.
create or replace function public.get_public_properties_v2()
returns table (
  id uuid, slug text, name text, description text, city text, address text,
  formatted_address text, pincode text, property_type text, amenities text[], photos text[],
  contact_number text, latitude double precision, longitude double precision,
  location_verified boolean, active_tenant_count integer, total_rooms integer,
  available_room_count integer, total_capacity integer, current_occupants integer,
  lowest_rent numeric, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with room_stats as (
    select room.property_id,
      count(*)::integer as total_rooms,
      count(*) filter (where room.current_occupants < room.capacity)::integer as available_room_count,
      coalesce(sum(room.capacity), 0)::integer as total_capacity,
      coalesce(sum(room.current_occupants), 0)::integer as current_occupants,
      min(room.monthly_rent) as lowest_rent
    from public.rooms room
    group by room.property_id
  ), tenant_stats as (
    select tenant.property_id, count(*)::integer as active_tenant_count
    from public.tenants tenant
    where tenant.status in ('active', 'notice_period', 'payment_pending')
    group by tenant.property_id
  )
  select property.id, property.slug, property.name, property.description, property.city,
    property.address, property.formatted_address, property.pincode, property.property_type,
    property.amenities, property.photos, property.contact_number, property.latitude,
    property.longitude, property.location_verified, tenant_stats.active_tenant_count,
    coalesce(room_stats.total_rooms, 0), coalesce(room_stats.available_room_count, 0),
    coalesce(room_stats.total_capacity, 0), coalesce(room_stats.current_occupants, 0),
    room_stats.lowest_rent, property.created_at, property.updated_at
  from public.properties property
  join tenant_stats on tenant_stats.property_id = property.id
  left join room_stats on room_stats.property_id = property.id
  where property.is_active = true
    and coalesce(property.lifecycle_status, 'active') = 'active'
    and property.archived_at is null
  order by property.created_at desc;
$$;

revoke all on function public.get_public_properties_v2() from public, anon, authenticated;
grant execute on function public.get_public_properties_v2() to anon, authenticated;

create or replace function public.get_my_roommate_contacts()
returns table (id uuid, name text, phone text)
language sql stable security definer set search_path = ''
as $$
  with requester as (
    select tenant.id, tenant.property_id, tenant.room_id
    from public.tenants tenant
    where tenant.user_id = auth.uid()
      and tenant.status in ('active', 'notice_period', 'payment_pending')
      and tenant.room_id is not null
    limit 1
  )
  select roommate.id, roommate.name, roommate.phone
  from public.tenants roommate
  join requester on requester.property_id = roommate.property_id
    and requester.room_id = roommate.room_id
  where roommate.id <> requester.id
    and roommate.status in ('active', 'notice_period', 'payment_pending')
  order by roommate.name;
$$;

revoke all on function public.get_my_roommate_contacts() from public, anon, authenticated;
grant execute on function public.get_my_roommate_contacts() to authenticated;
