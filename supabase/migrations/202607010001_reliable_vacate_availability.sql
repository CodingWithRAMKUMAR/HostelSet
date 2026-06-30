-- Reliable tenant -> owner -> public vacate/pre-booking state.
-- Public pages read safe room flags instead of private tenant request rows.

alter table public.rooms
  add column if not exists next_vacate_date date,
  add column if not exists has_approved_prebooking boolean not null default false;

-- Keep one canonical active request per tenant and prevent future duplicates.
with ranked as (
  select id, row_number() over (
    partition by tenant_id
    order by (status = 'approved') desc, created_at desc, id desc
  ) as position
  from public.check_out_requests
  where status in ('pending', 'approved')
)
update public.check_out_requests request
set status = 'rejected', processed_at = coalesce(request.processed_at, now())
from ranked
where request.id = ranked.id and ranked.position > 1;

create unique index if not exists check_out_requests_one_active_per_tenant
  on public.check_out_requests(tenant_id)
  where status in ('pending', 'approved');

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
        select 1 from public.pre_bookings booking
        where booking.room_id = p_room_id and booking.status = 'approved'
      )
  where room.id = p_room_id;
end;
$$;

create or replace function public.sync_room_public_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_room_public_availability(coalesce(new.room_id, old.room_id));
  if tg_op = 'UPDATE' and old.room_id is distinct from new.room_id then
    perform public.refresh_room_public_availability(old.room_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists check_out_requests_public_availability on public.check_out_requests;
create trigger check_out_requests_public_availability
after insert or update or delete on public.check_out_requests
for each row execute function public.sync_room_public_availability();

drop trigger if exists pre_bookings_public_availability on public.pre_bookings;
create trigger pre_bookings_public_availability
after insert or update or delete on public.pre_bookings
for each row execute function public.sync_room_public_availability();

drop function if exists public.approve_vacate_request(uuid, uuid, date);

create function public.approve_vacate_request(
  p_request_id uuid,
  p_tenant_id uuid,
  p_expected_check_out date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.check_out_requests%rowtype;
  property_owner uuid;
begin
  select * into request_record from public.check_out_requests
  where id = p_request_id and tenant_id = p_tenant_id for update;
  if request_record.id is null then raise exception 'Vacate request not found'; end if;
  if request_record.status <> 'pending' then raise exception 'Vacate request has already been processed'; end if;
  select owner_id into property_owner from public.properties where id = request_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;

  update public.check_out_requests
  set status = 'approved', expected_check_out = p_expected_check_out, processed_at = now()
  where id = request_record.id;
  update public.tenants
  set status = 'notice_period', check_out_requested = true,
      notice_period_start = current_date, notice_period_end = p_expected_check_out
  where id = p_tenant_id;
  return jsonb_build_object('success', true, 'status', 'approved', 'expected_check_out', p_expected_check_out);
end;
$$;

revoke all on function public.approve_vacate_request(uuid, uuid, date) from public, anon;
grant execute on function public.approve_vacate_request(uuid, uuid, date) to authenticated;

-- Initialise safe public fields for existing approved records.
update public.rooms room
set next_vacate_date = (
      select min(request.expected_check_out) from public.check_out_requests request
      where request.room_id = room.id and request.status = 'approved'
    ),
    has_approved_prebooking = exists (
      select 1 from public.pre_bookings booking
      where booking.room_id = room.id and booking.status = 'approved'
    );

create index if not exists rooms_public_vacate_idx
  on public.rooms(property_id, next_vacate_date)
  where next_vacate_date is not null;
