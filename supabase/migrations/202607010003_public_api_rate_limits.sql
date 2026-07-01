-- Distributed rate limiting for unauthenticated Next.js API routes.
-- Identifiers are HMAC-hashed by the API before reaching this table.

create table if not exists public.public_api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start bigint not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start),
  constraint public_api_rate_limits_scope_valid check (scope ~ '^[a-z0-9:_-]{1,80}$'),
  constraint public_api_rate_limits_hash_valid check (key_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists public_api_rate_limits_expiry_idx
  on public.public_api_rate_limits(expires_at);

alter table public.public_api_rate_limits enable row level security;
revoke all on table public.public_api_rate_limits from public, anon, authenticated;
grant all on table public.public_api_rate_limits to service_role;

create or replace function public.consume_public_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  current_window bigint;
  current_count integer;
begin
  if p_scope !~ '^[a-z0-9:_-]{1,80}$'
    or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 10 or p_window_seconds > 604800 then
    raise exception 'Invalid rate limit configuration';
  end if;

  current_window := current_epoch - (current_epoch % p_window_seconds);

  insert into public.public_api_rate_limits (
    scope, key_hash, window_start, request_count, expires_at, updated_at
  ) values (
    p_scope, p_key_hash, current_window, 1,
    to_timestamp(current_window + p_window_seconds), clock_timestamp()
  )
  on conflict (scope, key_hash, window_start) do update
  set request_count = public.public_api_rate_limits.request_count + 1,
      updated_at = clock_timestamp()
  where public.public_api_rate_limits.request_count < p_limit
  returning request_count into current_count;

  if current_count is null then
    select limiter.request_count into current_count
    from public.public_api_rate_limits limiter
    where limiter.scope = p_scope
      and limiter.key_hash = p_key_hash
      and limiter.window_start = current_window;
    allowed := false;
  else
    allowed := true;
  end if;

  remaining := greatest(0, p_limit - current_count);
  retry_after := greatest(1, (current_window + p_window_seconds - current_epoch)::integer);
  return next;
end;
$$;

revoke all on function public.consume_public_api_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_api_rate_limit(text,text,integer,integer)
  to service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'hostelset-public-api-rate-limit-cleanup';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'hostelset-public-api-rate-limit-cleanup',
    '17 * * * *',
    'delete from public.public_api_rate_limits where expires_at < now() - interval ''1 hour'';'
  );
end $$;
