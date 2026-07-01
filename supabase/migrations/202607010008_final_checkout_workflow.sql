-- Complete approved vacates when their checkout date arrives.
-- Reuses the existing hourly rent scheduler; no additional cron job is created.

alter table public.check_out_requests
  add column if not exists completed_at timestamptz;

alter table public.check_out_requests
  drop constraint if exists check_out_requests_status_check;
alter table public.check_out_requests
  add constraint check_out_requests_status_check
  check (status in ('pending','approved','rejected','cancelled','completed'));

create or replace function public.complete_due_vacate_requests(
  p_reference_date date default (now() at time zone 'Asia/Kolkata')::date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record record;
  tenant_record public.tenants%rowtype;
  room_record public.rooms%rowtype;
  new_occupants integer;
  completed_count integer := 0;
begin
  if p_reference_date is null then raise exception 'Reference date is required'; end if;

  for request_record in
    select request.id, request.tenant_id, request.room_id
    from public.check_out_requests request
    where request.status = 'approved'
      and request.expected_check_out <= p_reference_date
    order by request.expected_check_out, request.id
    for update skip locked
  loop
    select * into tenant_record
    from public.tenants
    where id = request_record.tenant_id
    for update;

    if tenant_record.id is not null and tenant_record.status <> 'inactive' then
      select * into room_record
      from public.rooms
      where id = tenant_record.room_id
      for update;

      update public.tenants
      set status = 'inactive',
          check_out_requested = false,
          updated_at = now()
      where id = tenant_record.id;

      if room_record.id is not null then
        new_occupants := greatest(0, coalesce(room_record.current_occupants, 0) - 1);
        update public.rooms
        set current_occupants = new_occupants,
            status = case when new_occupants >= capacity then 'occupied' else 'vacant' end,
            updated_at = now()
        where id = room_record.id;
      end if;
    end if;

    update public.rent_reminder_queue queue
    set status = 'cancelled',
        lock_token = null,
        locked_at = null,
        last_error = 'Tenant checkout completed',
        updated_at = now()
    where queue.rent_id in (
      select rent.id from public.rent_records rent
      where rent.tenant_id = request_record.tenant_id
    )
      and queue.status in ('pending','processing','failed');

    update public.rent_records
    set status = 'cancelled', updated_at = now()
    where tenant_id = request_record.tenant_id
      and status = 'unpaid';

    update public.room_change_requests
    set status = 'rejected',
        rejection_reason = coalesce(rejection_reason, 'Tenant checkout completed'),
        processed_at = coalesce(processed_at, now()),
        updated_at = now()
    where tenant_id = request_record.tenant_id
      and status = 'pending';

    update public.check_out_requests
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = request_record.id
      and status = 'approved';

    if found then completed_count := completed_count + 1; end if;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.complete_due_vacate_requests(date)
  from public, anon, authenticated;
grant execute on function public.complete_due_vacate_requests(date)
  to service_role;

create or replace function public.run_rent_reminder_scheduler(
  p_reference_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vacates_completed integer;
  materialized integer;
  weekly_scheduled integer;
  stale_recovered integer;
  stale_cancelled integer;
  ready_count integer;
begin
  vacates_completed := public.complete_due_vacate_requests((p_reference_time at time zone 'Asia/Kolkata')::date);
  materialized := public.materialize_monthly_rent_records((p_reference_time at time zone 'Asia/Kolkata')::date);
  weekly_scheduled := public.schedule_weekly_overdue_reminders(p_reference_time);
  stale_recovered := public.recover_stale_rent_reminders(p_reference_time);
  stale_cancelled := public.cancel_stale_rent_reminders(p_reference_time);

  select count(*) into ready_count
  from public.rent_reminder_queue queue
  join public.rent_records rent on rent.id = queue.rent_id
  where queue.status in ('pending', 'failed')
    and queue.scheduled_at <= p_reference_time
    and queue.retry_count < queue.max_retries
    and rent.status = 'unpaid'
    and rent.reminders_enabled;

  return jsonb_build_object(
    'vacates_completed', vacates_completed,
    'materialized_rents', materialized,
    'weekly_reminders_scheduled', weekly_scheduled,
    'stale_locks_recovered', stale_recovered,
    'stale_reminders_cancelled', stale_cancelled,
    'ready_for_delivery', ready_count
  );
end;
$$;

revoke all on function public.run_rent_reminder_scheduler(timestamptz)
  from public, anon, authenticated;
grant execute on function public.run_rent_reminder_scheduler(timestamptz)
  to service_role;
