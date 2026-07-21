-- Suppress tenant rent reminders while a submitted rent payment is awaiting owner review.
-- A payment_pending row does not mark the rent record paid, but it must pause tenant reminders.

create or replace function public.schedule_initial_rent_reminders(p_rent_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  rent_record public.rent_records%rowtype;
  has_pending_payment boolean := false;
begin
  select *
  into rent_record
  from public.rent_records
  where id = p_rent_id;

  if rent_record.id is null then
    raise exception 'Rent record not found';
  end if;

  select exists (
    select 1
    from public.payment_history payment
    where payment.rent_id = rent_record.id
      and payment.status = 'payment_pending'
      and payment.payment_method is distinct from 'security_deposit'
  )
  into has_pending_payment;

  if rent_record.status <> 'unpaid'
     or not rent_record.reminders_enabled
     or has_pending_payment then
    update public.rent_reminder_queue
    set status = 'cancelled',
        lock_token = null,
        locked_at = null,
        updated_at = now()
    where rent_id = rent_record.id
      and status in ('pending', 'processing', 'failed');

    return;
  end if;

  insert into public.rent_reminder_queue (
    tenant_id,
    owner_id,
    rent_id,
    reminder_type,
    reminder_sequence,
    scheduled_at
  )
  values
    (
      rent_record.tenant_id,
      rent_record.owner_id,
      rent_record.id,
      'before_due',
      0,
      public.rent_reminder_time(
        rent_record.due_date - 3,
        rent_record.reminder_timezone
      )
    ),
    (
      rent_record.tenant_id,
      rent_record.owner_id,
      rent_record.id,
      'due_today',
      0,
      public.rent_reminder_time(
        rent_record.due_date,
        rent_record.reminder_timezone
      )
    ),
    (
      rent_record.tenant_id,
      rent_record.owner_id,
      rent_record.id,
      'overdue_2_days',
      0,
      public.rent_reminder_time(
        rent_record.due_date + 2,
        rent_record.reminder_timezone
      )
    )
  on conflict (rent_id, reminder_type, reminder_sequence) do update
  set tenant_id = excluded.tenant_id,
      owner_id = excluded.owner_id,
      scheduled_at = excluded.scheduled_at,
      status = case
        when public.rent_reminder_queue.status in ('succeeded', 'dead_letter')
          then public.rent_reminder_queue.status
        else 'pending'
      end,
      retry_count = case
        when public.rent_reminder_queue.status in ('succeeded', 'dead_letter')
          then public.rent_reminder_queue.retry_count
        else 0
      end,
      lock_token = null,
      locked_at = null,
      last_error = null,
      updated_at = now();
end;
$function$;

create or replace function public.claim_due_rent_reminders(
  p_lock_token uuid,
  p_batch_size integer default 25,
  p_reference_time timestamp with time zone default now()
)
returns table(
  id uuid,
  tenant_id uuid,
  owner_id uuid,
  rent_id uuid,
  reminder_type text,
  scheduled_at timestamp with time zone,
  retry_count integer,
  tenant_email text,
  tenant_name text,
  amount numeric,
  due_date date
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_lock_token is null then
    raise exception 'Lock token is required';
  end if;

  if p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'Batch size must be between 1 and 100';
  end if;

  return query
  with candidates as (
    select queue.id
    from public.rent_reminder_queue queue
    join public.rent_records rent on rent.id = queue.rent_id
    where queue.status in ('pending', 'failed')
      and queue.scheduled_at <= p_reference_time
      and queue.retry_count < queue.max_retries
      and rent.status = 'unpaid'
      and rent.reminders_enabled
      and not exists (
        select 1
        from public.payment_history payment
        where payment.rent_id = rent.id
          and payment.status = 'payment_pending'
          and payment.payment_method is distinct from 'security_deposit'
      )
    order by queue.scheduled_at, queue.id
    for update of queue skip locked
    limit p_batch_size
  ), claimed as (
    update public.rent_reminder_queue queue
    set status = 'processing',
        lock_token = p_lock_token,
        locked_at = p_reference_time,
        last_attempt_at = p_reference_time,
        updated_at = p_reference_time
    from candidates
    where queue.id = candidates.id
    returning queue.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.owner_id,
    claimed.rent_id,
    claimed.reminder_type,
    claimed.scheduled_at,
    claimed.retry_count,
    tenant.email,
    tenant.name,
    rent.amount,
    rent.due_date
  from claimed
  join public.tenants tenant on tenant.id = claimed.tenant_id
  join public.rent_records rent on rent.id = claimed.rent_id;
end;
$function$;

create or replace function public.run_rent_reminder_scheduler(
  p_reference_time timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  vacates_completed integer;
  materialized integer;
  weekly_scheduled integer;
  stale_recovered integer;
  stale_cancelled integer;
  pending_payment_reminders_cancelled integer;
  ready_count integer;
begin
  vacates_completed := public.complete_due_vacate_requests(
    (p_reference_time at time zone 'Asia/Kolkata')::date
  );

  materialized := public.materialize_monthly_rent_records(
    (p_reference_time at time zone 'Asia/Kolkata')::date
  );

  weekly_scheduled := public.schedule_weekly_overdue_reminders(p_reference_time);
  stale_recovered := public.recover_stale_rent_reminders(p_reference_time);
  stale_cancelled := public.cancel_stale_rent_reminders(p_reference_time);

  update public.rent_reminder_queue queue
  set status = 'cancelled',
      lock_token = null,
      locked_at = null,
      updated_at = p_reference_time
  where queue.status in ('pending', 'failed', 'processing')
    and exists (
      select 1
      from public.payment_history payment
      where payment.rent_id = queue.rent_id
        and payment.status = 'payment_pending'
        and payment.payment_method is distinct from 'security_deposit'
    );

  get diagnostics pending_payment_reminders_cancelled = row_count;

  select count(*)
  into ready_count
  from public.rent_reminder_queue queue
  join public.rent_records rent on rent.id = queue.rent_id
  where queue.status in ('pending', 'failed')
    and queue.scheduled_at <= p_reference_time
    and queue.retry_count < queue.max_retries
    and rent.status = 'unpaid'
    and rent.reminders_enabled
    and not exists (
      select 1
      from public.payment_history payment
      where payment.rent_id = rent.id
        and payment.status = 'payment_pending'
        and payment.payment_method is distinct from 'security_deposit'
    );

  return jsonb_build_object(
    'vacates_completed', vacates_completed,
    'materialized_rents', materialized,
    'weekly_reminders_scheduled', weekly_scheduled,
    'stale_locks_recovered', stale_recovered,
    'stale_reminders_cancelled', stale_cancelled,
    'pending_payment_reminders_cancelled', pending_payment_reminders_cancelled,
    'ready_for_delivery', ready_count
  );
end;
$function$;

-- Clean up reminder work that was queued before this migration.
update public.rent_reminder_queue queue
set status = 'cancelled',
    lock_token = null,
    locked_at = null,
    updated_at = now()
where queue.status in ('pending', 'failed', 'processing')
  and exists (
    select 1
    from public.payment_history payment
    where payment.rent_id = queue.rent_id
      and payment.status = 'payment_pending'
      and payment.payment_method is distinct from 'security_deposit'
  );
