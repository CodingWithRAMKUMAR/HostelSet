-- Delivery activation safety. The worker remains provider-independent, while
-- Brevo credentials and template IDs are supplied only through Function secrets.

create or replace function public.cancel_stale_rent_reminders(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_count integer;
begin
  update public.rent_reminder_queue
  set status = 'cancelled',
      lock_token = null,
      locked_at = null,
      last_error = 'Reminder expired before delivery',
      updated_at = p_reference_time
  where status in ('pending', 'processing', 'failed')
    and scheduled_at < p_reference_time - case reminder_type
      when 'before_due' then interval '24 hours'
      when 'due_today' then interval '24 hours'
      when 'overdue_2_days' then interval '7 days'
      else interval '7 days'
    end;

  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;

create or replace function public.run_rent_reminder_scheduler(
  p_reference_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  materialized integer;
  weekly_scheduled integer;
  stale_recovered integer;
  stale_cancelled integer;
  ready_count integer;
begin
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
    'materialized_rents', materialized,
    'weekly_reminders_scheduled', weekly_scheduled,
    'stale_locks_recovered', stale_recovered,
    'stale_reminders_cancelled', stale_cancelled,
    'ready_for_delivery', ready_count
  );
end;
$$;

revoke all on function public.cancel_stale_rent_reminders(timestamptz)
  from public, anon, authenticated;
revoke all on function public.run_rent_reminder_scheduler(timestamptz)
  from public, anon, authenticated;
grant execute on function public.run_rent_reminder_scheduler(timestamptz)
  to service_role;

-- Never deliver reminders that became due while delivery was intentionally
-- disabled. Future reminders and the next weekly overdue reminder stay pending.
update public.rent_reminder_queue
set status = 'cancelled',
    lock_token = null,
    locked_at = null,
    last_error = 'Cancelled during Brevo delivery activation',
    updated_at = now()
where status in ('pending', 'processing', 'failed')
  and scheduled_at < now();

select public.run_rent_reminder_scheduler();
