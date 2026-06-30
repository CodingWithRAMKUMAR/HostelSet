-- Production rent reminder infrastructure.
-- Delivery is intentionally provider-independent: this migration schedules and
-- queues reminders, while an external worker completes or retries delivery.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table if not exists public.rent_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'cancelled')),
  reminders_enabled boolean not null default true,
  reminder_timezone text not null default 'Asia/Kolkata',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_records_period_valid check (period_end >= period_start),
  constraint rent_records_paid_at_valid check (
    (status = 'paid' and paid_at is not null) or status <> 'paid'
  ),
  constraint rent_records_tenant_period_unique unique (tenant_id, period_start)
);

create table if not exists public.rent_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  rent_id uuid not null references public.rent_records(id) on delete cascade,
  reminder_type text not null
    check (reminder_type in ('before_due', 'due_today', 'overdue_2_days', 'weekly_overdue')),
  reminder_sequence integer not null default 0 check (reminder_sequence >= 0),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'dead_letter')),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 5 check (max_retries between 1 and 20),
  lock_token uuid,
  locked_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_reminder_queue_delivery_unique
    unique (rent_id, reminder_type, reminder_sequence)
);

alter table public.payment_history
  add column if not exists rent_id uuid references public.rent_records(id) on delete set null;

create index if not exists rent_records_due_unpaid_idx
  on public.rent_records(due_date, tenant_id)
  where status = 'unpaid' and reminders_enabled;

create index if not exists rent_records_owner_status_idx
  on public.rent_records(owner_id, status, due_date desc);

create index if not exists rent_records_tenant_status_idx
  on public.rent_records(tenant_id, status, due_date desc);

create index if not exists rent_reminder_queue_dispatch_idx
  on public.rent_reminder_queue(scheduled_at, id)
  where status in ('pending', 'failed');

create index if not exists rent_reminder_queue_stale_lock_idx
  on public.rent_reminder_queue(locked_at)
  where status = 'processing';

create index if not exists rent_reminder_queue_rent_status_idx
  on public.rent_reminder_queue(rent_id, status, scheduled_at);

create index if not exists payment_history_rent_idx
  on public.payment_history(rent_id)
  where rent_id is not null;

alter table public.rent_records enable row level security;
alter table public.rent_reminder_queue enable row level security;

-- Queue contents are operational data. Browser clients cannot read or mutate it.
revoke all on table public.rent_records from anon, authenticated;
revoke all on table public.rent_reminder_queue from anon, authenticated;
grant all on table public.rent_records to service_role;
grant all on table public.rent_reminder_queue to service_role;

create or replace function public.rent_reminder_time(
  p_date date,
  p_timezone text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date::timestamp + time '09:00') at time zone p_timezone;
$$;

create or replace function public.schedule_initial_rent_reminders(p_rent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rent_record public.rent_records%rowtype;
begin
  select * into rent_record
  from public.rent_records
  where id = p_rent_id;

  if rent_record.id is null then
    raise exception 'Rent record not found';
  end if;

  if rent_record.status <> 'unpaid' or not rent_record.reminders_enabled then
    update public.rent_reminder_queue
    set status = 'cancelled', lock_token = null, locked_at = null, updated_at = now()
    where rent_id = rent_record.id
      and status in ('pending', 'processing', 'failed');
    return;
  end if;

  insert into public.rent_reminder_queue (
    tenant_id, owner_id, rent_id, reminder_type, reminder_sequence, scheduled_at
  )
  values
    (rent_record.tenant_id, rent_record.owner_id, rent_record.id, 'before_due', 0,
      public.rent_reminder_time(rent_record.due_date - 3, rent_record.reminder_timezone)),
    (rent_record.tenant_id, rent_record.owner_id, rent_record.id, 'due_today', 0,
      public.rent_reminder_time(rent_record.due_date, rent_record.reminder_timezone)),
    (rent_record.tenant_id, rent_record.owner_id, rent_record.id, 'overdue_2_days', 0,
      public.rent_reminder_time(rent_record.due_date + 2, rent_record.reminder_timezone))
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
$$;

create or replace function public.set_rent_record_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rent_records_updated_at on public.rent_records;
create trigger rent_records_updated_at
before update on public.rent_records
for each row execute function public.set_rent_record_updated_at();

create or replace function public.handle_rent_record_reminder_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('paid', 'cancelled') or not new.reminders_enabled then
    update public.rent_reminder_queue
    set status = 'cancelled', lock_token = null, locked_at = null, updated_at = now()
    where rent_id = new.id
      and status in ('pending', 'processing', 'failed');
  elsif tg_op = 'INSERT'
    or old.due_date is distinct from new.due_date
    or old.reminder_timezone is distinct from new.reminder_timezone
    or old.reminders_enabled is distinct from new.reminders_enabled
    or old.status is distinct from new.status then
    perform public.schedule_initial_rent_reminders(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists rent_records_reminder_schedule on public.rent_records;
create trigger rent_records_reminder_schedule
after insert or update of due_date, reminder_timezone, reminders_enabled, status
on public.rent_records
for each row execute function public.handle_rent_record_reminder_schedule();

create or replace function public.materialize_monthly_rent_records(
  p_reference_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with months as (
    select generate_series(
      date_trunc('month', p_reference_date)::date,
      (date_trunc('month', p_reference_date) + interval '1 month')::date,
      interval '1 month'
    )::date as period_start
  ), candidate_rents as (
    select
      tenant.id as tenant_id,
      property.owner_id,
      month.period_start,
      (month.period_start + interval '1 month - 1 day')::date as period_end,
      (
        month.period_start
        + (
          least(
            extract(day from tenant.move_in_date)::integer,
            extract(day from (month.period_start + interval '1 month - 1 day'))::integer
          ) - 1
        ) * interval '1 day'
      )::date as due_date,
      tenant.rent_amount::numeric(12, 2) as amount,
      case
        when month.period_start = date_trunc('month', p_reference_date)::date
          and coalesce(tenant.pending_amount, 0) <= 0
          and tenant.rent_status = 'paid'
        then 'paid'
        else 'unpaid'
      end as rent_status
    from public.tenants tenant
    join public.properties property on property.id = tenant.property_id
    cross join months month
    where tenant.status = 'active'
      and tenant.move_in_date is not null
      and coalesce(tenant.rent_amount, 0) > 0
      and month.period_start >= date_trunc('month', tenant.move_in_date)::date
  )
  insert into public.rent_records (
    tenant_id, owner_id, period_start, period_end, due_date, amount, status, paid_at
  )
  select
    tenant_id, owner_id, period_start, period_end, due_date, amount, rent_status,
    case when rent_status = 'paid' then now() else null end
  from candidate_rents
  on conflict (tenant_id, period_start) do update
  set owner_id = excluded.owner_id,
      amount = excluded.amount,
      period_end = excluded.period_end,
      due_date = excluded.due_date,
      updated_at = now()
  where public.rent_records.status = 'unpaid';

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.schedule_weekly_overdue_reminders(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.rent_reminder_queue (
    tenant_id, owner_id, rent_id, reminder_type, reminder_sequence, scheduled_at
  )
  select
    rent.tenant_id,
    rent.owner_id,
    rent.id,
    'weekly_overdue',
    greatest(
      1,
      floor(((p_reference_time at time zone rent.reminder_timezone)::date - (rent.due_date + 2)) / 7.0)::integer + 1
    ) as reminder_sequence,
    public.rent_reminder_time(
      rent.due_date + 2 + (
        greatest(
          1,
          floor(((p_reference_time at time zone rent.reminder_timezone)::date - (rent.due_date + 2)) / 7.0)::integer + 1
        ) * 7
      ),
      rent.reminder_timezone
    ) as scheduled_at
  from public.rent_records rent
  where rent.status = 'unpaid'
    and rent.reminders_enabled
    and (p_reference_time at time zone rent.reminder_timezone)::date >= rent.due_date + 2
    and not exists (
      select 1
      from public.rent_reminder_queue outstanding
      where outstanding.rent_id = rent.id
        and outstanding.reminder_type = 'weekly_overdue'
        and outstanding.status in ('pending', 'processing', 'failed')
    )
  on conflict (rent_id, reminder_type, reminder_sequence) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.recover_stale_rent_reminders(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovered_count integer;
begin
  update public.rent_reminder_queue
  set retry_count = retry_count + 1,
      status = case when retry_count + 1 >= max_retries then 'dead_letter' else 'failed' end,
      scheduled_at = case
        when retry_count + 1 >= max_retries then scheduled_at
        else p_reference_time + make_interval(mins => least(360, power(2, retry_count + 1)::integer))
      end,
      lock_token = null,
      locked_at = null,
      last_error = 'Delivery worker lock expired',
      updated_at = p_reference_time
  where status = 'processing'
    and locked_at < p_reference_time - interval '15 minutes';

  get diagnostics recovered_count = row_count;
  return recovered_count;
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
  ready_count integer;
begin
  materialized := public.materialize_monthly_rent_records((p_reference_time at time zone 'Asia/Kolkata')::date);
  weekly_scheduled := public.schedule_weekly_overdue_reminders(p_reference_time);
  stale_recovered := public.recover_stale_rent_reminders(p_reference_time);

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
    'ready_for_delivery', ready_count
  );
end;
$$;

create or replace function public.claim_due_rent_reminders(
  p_lock_token uuid,
  p_batch_size integer default 25,
  p_reference_time timestamptz default now()
)
returns table (
  id uuid,
  tenant_id uuid,
  owner_id uuid,
  rent_id uuid,
  reminder_type text,
  scheduled_at timestamptz,
  retry_count integer,
  tenant_email text,
  tenant_name text,
  amount numeric,
  due_date date
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.complete_rent_reminder(
  p_reminder_id uuid,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rent_reminder_queue
  set status = 'succeeded',
      sent_at = now(),
      lock_token = null,
      locked_at = null,
      last_error = null,
      updated_at = now()
  where id = p_reminder_id
    and status = 'processing'
    and lock_token = p_lock_token;
  return found;
end;
$$;

create or replace function public.fail_rent_reminder(
  p_reminder_id uuid,
  p_lock_token uuid,
  p_error text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  update public.rent_reminder_queue
  set retry_count = retry_count + 1,
      status = case when retry_count + 1 >= max_retries then 'dead_letter' else 'failed' end,
      scheduled_at = case
        when retry_count + 1 >= max_retries then scheduled_at
        else now() + make_interval(mins => least(360, power(2, retry_count + 1)::integer))
      end,
      lock_token = null,
      locked_at = null,
      last_error = left(coalesce(nullif(trim(p_error), ''), 'Unknown delivery error'), 2000),
      updated_at = now()
  where id = p_reminder_id
    and status = 'processing'
    and lock_token = p_lock_token
  returning status into next_status;

  if next_status is null then
    raise exception 'Reminder is not owned by this worker';
  end if;
  return next_status;
end;
$$;

create or replace function public.attach_payment_to_rent_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rent_id is null then
    select rent.id into new.rent_id
    from public.rent_records rent
    where rent.tenant_id = new.tenant_id
      and rent.status = 'unpaid'
    order by rent.due_date, rent.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_history_attach_rent on public.payment_history;
create trigger payment_history_attach_rent
before insert or update of tenant_id, rent_id
on public.payment_history
for each row execute function public.attach_payment_to_rent_record();

create or replace function public.sync_successful_payment_to_rent_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_balance numeric;
  tenant_rent_status text;
begin
  if new.status = 'success'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
    and new.rent_id is not null then
    select pending_amount, rent_status
    into tenant_balance, tenant_rent_status
    from public.tenants
    where id = new.tenant_id;

    if coalesce(tenant_balance, 0) <= 0 or tenant_rent_status = 'paid' then
      update public.rent_records
      set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
      where id = new.rent_id and status = 'unpaid';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_history_complete_rent on public.payment_history;
create trigger payment_history_complete_rent
after insert or update of status
on public.payment_history
for each row execute function public.sync_successful_payment_to_rent_record();

create or replace function public.sync_paid_tenant_rent_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    update public.rent_records
    set status = 'cancelled', updated_at = now()
    where tenant_id = new.id and status = 'unpaid';
  elsif coalesce(new.pending_amount, 0) <= 0 and new.rent_status = 'paid' then
    update public.rent_records
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where tenant_id = new.id
      and status = 'unpaid'
      and period_start <= date_trunc('month', current_date)::date;
  end if;
  return new;
end;
$$;

drop trigger if exists tenants_sync_rent_records on public.tenants;
create trigger tenants_sync_rent_records
after update of pending_amount, rent_status, status
on public.tenants
for each row execute function public.sync_paid_tenant_rent_records();

revoke all on function public.schedule_initial_rent_reminders(uuid) from public, anon, authenticated;
revoke all on function public.materialize_monthly_rent_records(date) from public, anon, authenticated;
revoke all on function public.schedule_weekly_overdue_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.recover_stale_rent_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.run_rent_reminder_scheduler(timestamptz) from public, anon, authenticated;
revoke all on function public.claim_due_rent_reminders(uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_rent_reminder(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_rent_reminder(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.run_rent_reminder_scheduler(timestamptz) to service_role;
grant execute on function public.claim_due_rent_reminders(uuid, integer, timestamptz) to service_role;
grant execute on function public.complete_rent_reminder(uuid, uuid) to service_role;
grant execute on function public.fail_rent_reminder(uuid, uuid, text) to service_role;

-- The database scheduler materializes rents, schedules recurring reminders,
-- and recovers abandoned worker locks every hour. Delivery remains disabled
-- until an EmailService provider is configured and the worker is deployed.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'hostelset-rent-reminder-scheduler-hourly';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'hostelset-rent-reminder-scheduler-hourly',
    '0 * * * *',
    'select public.run_rent_reminder_scheduler();'
  );
end $$;

-- Seed this month and next month. The operation is idempotent.
select public.run_rent_reminder_scheduler();
