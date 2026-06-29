-- Manual membership approval workflow. Owners submit a request and an active
-- HostelSet admin approves or rejects it. No payment gateway is involved.
create extension if not exists pgcrypto;

create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  plan_id text not null check (plan_id in ('monthly', 'yearly')),
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  admin_note text
);

create unique index if not exists membership_requests_one_pending_per_owner
  on public.membership_requests(owner_id)
  where status = 'pending';

create index if not exists membership_requests_status_requested_idx
  on public.membership_requests(status, requested_at desc);

alter table public.membership_requests enable row level security;

drop policy if exists membership_requests_owner_select on public.membership_requests;
create policy membership_requests_owner_select
on public.membership_requests for select to authenticated
using (owner_id = (select auth.uid()) or public.is_hostelset_admin());

drop policy if exists membership_requests_owner_insert on public.membership_requests;
create policy membership_requests_owner_insert
on public.membership_requests for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.properties property
    where property.id = property_id
      and property.owner_id = (select auth.uid())
  )
);

drop policy if exists membership_requests_admin_manage on public.membership_requests;
create policy membership_requests_admin_manage
on public.membership_requests for all to authenticated
using (public.is_hostelset_admin())
with check (public.is_hostelset_admin());

create or replace function public.review_membership_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_request public.membership_requests%rowtype;
  current_expiry timestamptz;
  membership_start timestamptz;
  new_expiry timestamptz;
begin
  if not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;

  select * into membership_request
  from public.membership_requests
  where id = p_request_id
  for update;

  if membership_request.id is null then
    raise exception 'Membership request not found';
  end if;
  if membership_request.status <> 'pending' then
    raise exception 'Membership request has already been reviewed';
  end if;

  if not p_approve then
    update public.membership_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), admin_note = nullif(trim(p_admin_note), '')
    where id = p_request_id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  select membership_expiry into current_expiry
  from public.properties
  where id = membership_request.property_id
    and owner_id = membership_request.owner_id
  for update;

  if not found then
    raise exception 'Owner property not found';
  end if;

  membership_start := greatest(coalesce(current_expiry, now()), now());
  new_expiry := case membership_request.plan_id
    when 'yearly' then membership_start + interval '1 year'
    else membership_start + interval '1 month'
  end;

  update public.properties
  set membership_active = true, membership_expiry = new_expiry
  where id = membership_request.property_id;

  update public.membership_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), admin_note = nullif(trim(p_admin_note), '')
  where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'approved', 'membership_expiry', new_expiry);
end;
$$;

revoke all on function public.review_membership_request(uuid, boolean, text) from public;
grant execute on function public.review_membership_request(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_owner_membership(
  p_owner_id uuid,
  p_active boolean,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_expiry timestamptz;
  new_expiry timestamptz;
begin
  if not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;
  if p_active and (p_days is null or p_days < 1 or p_days > 3660) then
    raise exception 'Membership days must be between 1 and 3660';
  end if;

  select membership_expiry into current_expiry
  from public.properties
  where owner_id = p_owner_id
  for update;
  if not found then raise exception 'Owner property not found'; end if;

  if p_active then
    new_expiry := greatest(coalesce(current_expiry, now()), now()) + make_interval(days => p_days);
    update public.properties set membership_active = true, membership_expiry = new_expiry where owner_id = p_owner_id;
  else
    update public.properties set membership_active = false, membership_expiry = null where owner_id = p_owner_id;
  end if;

  return jsonb_build_object('success', true, 'active', p_active, 'membership_expiry', new_expiry);
end;
$$;

revoke all on function public.admin_set_owner_membership(uuid, boolean, integer) from public;
grant execute on function public.admin_set_owner_membership(uuid, boolean, integer) to authenticated;

create or replace function public.review_rent_payment(
  p_payment_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payment_history%rowtype;
  tenant_record public.tenants%rowtype;
  property_owner uuid;
  new_pending numeric;
begin
  select * into payment_record
  from public.payment_history
  where id = p_payment_id
  for update;
  if payment_record.id is null then raise exception 'Payment not found'; end if;
  if payment_record.status <> 'payment_pending' then raise exception 'Payment has already been reviewed'; end if;

  select * into tenant_record from public.tenants where id = payment_record.tenant_id for update;
  if tenant_record.id is null then raise exception 'Tenant not found'; end if;
  select owner_id into property_owner from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized to review this payment'; end if;

  if not p_approve then
    delete from public.payment_history where id = p_payment_id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  new_pending := greatest(0, coalesce(tenant_record.pending_amount, 0) - payment_record.amount);
  update public.tenants
  set total_paid = coalesce(total_paid, 0) + payment_record.amount,
      pending_amount = new_pending,
      rent_status = case when new_pending <= 0 then 'paid' else 'pending' end,
      last_payment_date = current_date
  where id = tenant_record.id;

  update public.payment_history set status = 'success' where id = p_payment_id;
  return jsonb_build_object('success', true, 'status', 'success');
end;
$$;

revoke all on function public.review_rent_payment(uuid, boolean) from public;
grant execute on function public.review_rent_payment(uuid, boolean) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'membership_requests'
  ) then
    alter publication supabase_realtime add table public.membership_requests;
  end if;
end $$;
