-- Keep application/security deposits separate from rent accounting.
-- Historical application deposit rows remain in payment_history but are
-- reclassified so future rent approvals do not reduce monthly rent due.

alter table public.tenants
  add column if not exists security_deposit_amount numeric(12,2) not null default 0 check (security_deposit_amount >= 0),
  add column if not exists security_deposit_status text not null default 'not_required'
    check (security_deposit_status in ('not_required','pending','paid')),
  add column if not exists security_deposit_refund_status text not null default 'not_refunded'
    check (security_deposit_refund_status in ('not_refunded','pending','refunded','forfeited'));

update public.payment_history payment
set payment_method = 'security_deposit'
from public.tenants tenant
join public.applications application
  on application.user_id = tenant.user_id
 and application.property_id = tenant.property_id
 and application.status = 'approved'
where payment.tenant_id = tenant.id
  and payment.payment_method = 'advance'
  and payment.amount = coalesce(application.payment_amount, 0)
  and coalesce(application.payment_amount, 0) > 0
  and (
    payment.upi_transaction_id is null
    or application.payment_transaction_id is null
    or payment.upi_transaction_id = application.payment_transaction_id
  );

update public.tenants tenant
set security_deposit_amount = deposit.amount,
    security_deposit_status = deposit.status
from (
  select
    tenant_id,
    max(amount) as amount,
    case
      when bool_or(status = 'success') then 'paid'
      when bool_or(status = 'payment_pending') then 'pending'
      else 'not_required'
    end as status
  from public.payment_history
  where payment_method = 'security_deposit'
  group by tenant_id
) deposit
where tenant.id = deposit.tenant_id;

update public.payment_history
set rent_id = null
where payment_method = 'security_deposit';

create or replace function public.attach_payment_to_rent_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_method = 'security_deposit' then
    new.rent_id := null;
    return new;
  end if;

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
  if new.payment_method = 'security_deposit' then
    return new;
  end if;

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

create or replace function public.approve_application_atomic(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  tenant_id uuid;
begin
  select * into application_record from public.applications
  where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;

  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record from public.rooms where id = application_record.room_id for update;
  if room_record.id is null or room_record.property_id <> application_record.property_id then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if application_record.user_id is null then raise exception 'Applicant account is missing'; end if;

  if exists (
    select 1 from public.tenants
    where property_id = application_record.property_id
      and (user_id = application_record.user_id or phone = application_record.phone)
      and status in ('active', 'payment_pending')
  ) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id,
    security_deposit_amount, security_deposit_status, security_deposit_refund_status
  ) values (
    application_record.user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id,
    greatest(0, coalesce(application_record.payment_amount, 0)),
    case when coalesce(application_record.payment_amount, 0) > 0 then 'pending' else 'not_required' end,
    'not_refunded'
  ) returning id into tenant_id;

  if coalesce(application_record.payment_amount, 0) > 0 then
    insert into public.payment_history (
      tenant_id, amount, payment_date, payment_method, status,
      upi_transaction_id, payment_screenshot
    ) values (
      tenant_id, application_record.payment_amount, current_date, 'security_deposit',
      'payment_pending', application_record.payment_transaction_id, application_record.payment_screenshot
    );
  end if;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end
  where id = room_record.id;

  update public.applications set status = 'approved', processed_at = now() where id = application_record.id;

  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
end;
$$;

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
  is_deposit boolean;
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

  is_deposit := payment_record.payment_method = 'security_deposit';

  if not p_approve then
    if is_deposit then
      update public.tenants
      set security_deposit_status = case when security_deposit_amount > 0 then 'pending' else 'not_required' end,
          updated_at = now()
      where id = tenant_record.id;
    end if;
    delete from public.payment_history where id = p_payment_id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  if is_deposit then
    update public.tenants
    set security_deposit_amount = greatest(security_deposit_amount, payment_record.amount),
        security_deposit_status = 'paid',
        security_deposit_refund_status = 'not_refunded',
        updated_at = now()
    where id = tenant_record.id;

    update public.payment_history set status = 'success' where id = p_payment_id;
    return jsonb_build_object('success', true, 'status', 'success', 'payment_type', 'security_deposit');
  end if;

  new_pending := greatest(0, coalesce(tenant_record.pending_amount, 0) - payment_record.amount);
  update public.tenants
  set total_paid = coalesce(total_paid, 0) + payment_record.amount,
      pending_amount = new_pending,
      rent_status = case when new_pending <= 0 then 'paid' else 'pending' end,
      last_payment_date = current_date
  where id = tenant_record.id;

  update public.payment_history set status = 'success' where id = p_payment_id;
  return jsonb_build_object('success', true, 'status', 'success', 'payment_type', 'rent');
end;
$$;

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_count bigint;
  tenant_count bigint;
  owner_count bigint;
  active_owner_count bigint;
  active_membership_count bigint;
  revenue_total numeric;
  deposit_total numeric;
  complaint_count bigint;
  vacate_count bigint;
begin
  select count(*) into property_count from public.properties;
  select count(*) into tenant_count from public.tenants
  where status in ('active', 'notice_period', 'payment_pending');
  select count(*) into owner_count from public.users where role = 'owner';
  select count(*) into active_owner_count from public.users where role = 'owner' and is_active;
  select count(*) into active_membership_count
  from public.properties
  where membership_active and membership_expiry > now();
  select coalesce(sum(amount), 0) into revenue_total
  from public.payment_history where status = 'success' and payment_method <> 'security_deposit';
  select coalesce(sum(amount), 0) into deposit_total
  from public.payment_history where status = 'success' and payment_method = 'security_deposit';
  select count(*) into complaint_count
  from public.complaints where status in ('open', 'in_progress');
  select count(*) into vacate_count
  from public.check_out_requests where status = 'pending';

  return jsonb_build_object(
    'totalProperties', property_count,
    'totalTenants', tenant_count,
    'totalOwners', owner_count,
    'activeOwners', active_owner_count,
    'activeMemberships', active_membership_count,
    'totalRevenue', revenue_total,
    'totalDeposits', deposit_total,
    'pendingComplaints', complaint_count,
    'pendingVacates', vacate_count
  );
end;
$$;

revoke all on function public.approve_application_atomic(uuid) from public, anon;
revoke all on function public.review_rent_payment(uuid, boolean) from public, anon;
revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
grant execute on function public.review_rent_payment(uuid, boolean) to authenticated;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
