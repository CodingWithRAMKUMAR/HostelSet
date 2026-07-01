-- Atomic room editing with ownership, capacity and supported-value validation.

alter table public.rooms
  drop constraint if exists rooms_sharing_type_valid;
alter table public.rooms
  add constraint rooms_sharing_type_valid
  check (sharing_type in ('single','double','triple','four','five'));

create or replace function public.update_owner_room(
  p_room_id uuid,
  p_room_number text,
  p_monthly_rent numeric,
  p_capacity integer,
  p_sharing_type text,
  p_room_audience text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_record public.rooms%rowtype;
  updated_room public.rooms%rowtype;
  property_owner uuid;
begin
  select * into room_record
  from public.rooms
  where id = p_room_id
  for update;

  if room_record.id is null then raise exception 'Room not found'; end if;

  select owner_id into property_owner
  from public.properties
  where id = room_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized to edit this room';
  end if;

  if nullif(trim(p_room_number), '') is null then raise exception 'Room number is required'; end if;
  if p_monthly_rent is null or p_monthly_rent < 0 then raise exception 'Monthly rent cannot be negative'; end if;
  if p_capacity is null or p_capacity <= 0 then raise exception 'Capacity must be greater than zero'; end if;
  if p_capacity < room_record.current_occupants then raise exception 'Capacity cannot be lower than current occupants'; end if;
  if p_sharing_type not in ('single','double','triple','four','five') then raise exception 'Unsupported sharing type'; end if;
  if p_room_audience not in ('boys','girls','coliving') then raise exception 'Unsupported room audience'; end if;
  if exists (
    select 1 from public.rooms room
    where room.property_id = room_record.property_id
      and room.room_number = trim(p_room_number)
      and room.id <> room_record.id
  ) then raise exception 'Room number already exists in this property'; end if;

  update public.rooms
  set room_number = trim(p_room_number),
      monthly_rent = p_monthly_rent,
      capacity = p_capacity,
      sharing_type = p_sharing_type,
      room_audience = p_room_audience,
      status = case when current_occupants >= p_capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id
  returning * into updated_room;

  if room_record.monthly_rent is distinct from p_monthly_rent then
    update public.tenants
    set rent_amount = p_monthly_rent, updated_at = now()
    where room_id = room_record.id
      and status in ('active','notice_period','payment_pending');

    update public.rent_records
    set amount = p_monthly_rent, updated_at = now()
    where tenant_id in (
      select tenant.id from public.tenants tenant
      where tenant.room_id = room_record.id
        and tenant.status in ('active','notice_period','payment_pending')
    )
      and status = 'unpaid'
      and period_start > date_trunc('month', current_date)::date;
  end if;

  return to_jsonb(updated_room);
end;
$$;

revoke all on function public.update_owner_room(uuid,text,numeric,integer,text,text)
  from public, anon;
grant execute on function public.update_owner_room(uuid,text,numeric,integer,text,text)
  to authenticated;
