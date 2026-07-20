-- Prevent an approved vacate from being cancelled after its vacancy has been reserved.
-- Cancellation is exposed through an atomic RPC and remains protected against direct DELETE calls.

create or replace function public.has_active_room_reservation(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pre_bookings booking
    where booking.room_id = p_room_id
      and booking.status in ('reserved', 'approved')
      and booking.deleted_at is null
  );
$$;

revoke all on function public.has_active_room_reservation(uuid) from public, anon, authenticated;
grant execute on function public.has_active_room_reservation(uuid) to service_role;

create or replace function public.get_vacate_cancellation_status(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_record public.check_out_requests%rowtype;
  tenant_user_id uuid;
  reservation_exists boolean;
begin
  select request.*
  into request_record
  from public.check_out_requests request
  where request.id = p_request_id;

  if request_record.id is null then
    return jsonb_build_object('can_cancel', false, 'reason', 'Vacate request not found.');
  end if;

  select tenant.user_id
  into tenant_user_id
  from public.tenants tenant
  where tenant.id = request_record.tenant_id;

  if tenant_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if request_record.status not in ('pending', 'approved') then
    return jsonb_build_object('can_cancel', false, 'reason', 'This vacate request is no longer active.');
  end if;

  reservation_exists := public.has_active_room_reservation(request_record.room_id);
  if reservation_exists then
    return jsonb_build_object(
      'can_cancel', false,
      'reason', 'This vacate request can no longer be cancelled because the room has already been reserved for another tenant.'
    );
  end if;

  return jsonb_build_object('can_cancel', true, 'reason', null);
end;
$$;

revoke all on function public.get_vacate_cancellation_status(uuid) from public, anon;
grant execute on function public.get_vacate_cancellation_status(uuid) to authenticated;

drop function if exists public.cancel_vacate_request(uuid);

create function public.cancel_vacate_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.check_out_requests%rowtype;
  tenant_record public.tenants%rowtype;
begin
  select request.*
  into request_record
  from public.check_out_requests request
  where request.id = p_request_id
  for update;

  if request_record.id is null then
    raise exception 'Vacate request not found';
  end if;

  select tenant.*
  into tenant_record
  from public.tenants tenant
  where tenant.id = request_record.tenant_id
  for update;

  if tenant_record.id is null or tenant_record.user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if request_record.status not in ('pending', 'approved') then
    raise exception 'This vacate request is no longer active';
  end if;

  if public.has_active_room_reservation(request_record.room_id) then
    raise exception 'This vacate request cannot be cancelled because the room has already been reserved for another tenant';
  end if;

  update public.check_out_requests
  set status = 'cancelled',
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where id = request_record.id;

  update public.tenants
  set status = 'active',
      check_out_requested = false,
      notice_period_start = null,
      notice_period_end = null,
      updated_at = now()
  where id = tenant_record.id;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_vacate_request(uuid) from public, anon;
grant execute on function public.cancel_vacate_request(uuid) to authenticated;

create or replace function public.block_reserved_vacate_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and public.has_active_room_reservation(old.room_id) then
    raise exception 'This vacate request cannot be cancelled because the room has already been reserved for another tenant';
  end if;
  return old;
end;
$$;

drop trigger if exists block_reserved_vacate_delete on public.check_out_requests;
create trigger block_reserved_vacate_delete
before delete on public.check_out_requests
for each row execute function public.block_reserved_vacate_delete();

