alter table public.properties
  add column if not exists locality text;

create or replace function public.add_property_for_existing_owner(
  p_owner_id uuid,
  p_property_name text,
  p_description text,
  p_address text,
  p_city text,
  p_locality text,
  p_pincode text,
  p_property_type text,
  p_contact_number text,
  p_owner_upi_id text,
  p_amenities text[],
  p_photos text[],
  p_latitude double precision,
  p_longitude double precision,
  p_formatted_address text,
  p_location_place_id text,
  p_rooms jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_property_id uuid;
  room_item jsonb;
  room_number text;
  sharing_type text;
  room_capacity integer;
  monthly_rent numeric;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;

  if not exists (
    select 1 from public.users
    where id = p_owner_id and role = 'owner' and is_active = true
  ) then
    raise exception 'Active owner account required';
  end if;

  if nullif(trim(p_property_name), '') is null then raise exception 'Property name is required'; end if;
  if nullif(trim(p_address), '') is null then raise exception 'Address is required'; end if;
  if nullif(trim(p_city), '') is null then raise exception 'City is required'; end if;
  if p_rooms is null or jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) < 1 then
    raise exception 'At least one room is required';
  end if;

  insert into public.properties(
    owner_id,name,description,address,city,locality,pincode,property_type,
    contact_number,owner_upi_id,amenities,photos,latitude,longitude,
    formatted_address,location_place_id,location_verified,
    membership_active,membership_expiry
  ) values (
    p_owner_id,trim(p_property_name),p_description,trim(p_address),trim(p_city),nullif(trim(coalesce(p_locality, '')), ''),
    p_pincode,coalesce(nullif(trim(p_property_type), ''), 'boys'),nullif(trim(coalesce(p_contact_number, '')), ''),
    nullif(trim(coalesce(p_owner_upi_id, '')), ''),coalesce(p_amenities, '{}'),coalesce(p_photos, '{}'),
    p_latitude,p_longitude,nullif(trim(coalesce(p_formatted_address, '')), ''),nullif(trim(coalesce(p_location_place_id, '')), ''),
    false,false,null
  ) returning id into new_property_id;

  insert into public.owner_settings(owner_id, property_id, upi_id, upi_phone)
  values(p_owner_id, new_property_id, nullif(trim(coalesce(p_owner_upi_id, '')), ''), nullif(trim(coalesce(p_contact_number, '')), ''))
  on conflict(property_id) do update set
    owner_id = excluded.owner_id,
    upi_id = excluded.upi_id,
    upi_phone = excluded.upi_phone,
    updated_at = now();

  for room_item in select * from jsonb_array_elements(p_rooms)
  loop
    room_number := nullif(trim(room_item->>'room_number'), '');
    sharing_type := coalesce(nullif(trim(room_item->>'sharing_type'), ''), 'custom');
    room_capacity := coalesce((room_item->>'capacity')::integer, 0);
    monthly_rent := coalesce((room_item->>'monthly_rent')::numeric, -1);

    if room_number is null then raise exception 'Room number is required'; end if;
    if room_capacity < 1 or room_capacity > 50 then raise exception 'Room capacity must be between 1 and 50'; end if;
    if monthly_rent < 0 then raise exception 'Monthly rent cannot be negative'; end if;

    insert into public.rooms(property_id, room_number, sharing_type, capacity, monthly_rent, current_occupants, status)
    values(new_property_id, room_number, sharing_type, room_capacity, monthly_rent, 0, 'vacant');
  end loop;

  return jsonb_build_object('success', true, 'property_id', new_property_id);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error', 'A room number is duplicated for this property');
end;
$$;

revoke all on function public.add_property_for_existing_owner(uuid,text,text,text,text,text,text,text,text,text,text[],text[],double precision,double precision,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.add_property_for_existing_owner(uuid,text,text,text,text,text,text,text,text,text,text[],text[],double precision,double precision,text,text,jsonb) to service_role;
