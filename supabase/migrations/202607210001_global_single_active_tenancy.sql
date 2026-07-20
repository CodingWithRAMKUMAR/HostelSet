-- Enforce the HostelSet identity rule:
--   * A person may have only one active tenancy globally.
--   * Archived tenant history does not block reapplication.
--   * active, notice_period and payment_pending records block reuse.
--
-- The indexes provide concurrency-safe enforcement. The RPC check provides
-- an understandable application error before the insert reaches an index.

do $$
begin
  if exists (
    select tenant.user_id
    from public.tenants tenant
    where tenant.user_id is not null
      and tenant.status in ('active', 'notice_period', 'payment_pending')
    group by tenant.user_id
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce global tenancy rule: duplicate active tenant user IDs already exist';
  end if;

  if exists (
    select tenant.phone
    from public.tenants tenant
    where tenant.phone is not null
      and btrim(tenant.phone) <> ''
      and tenant.status in ('active', 'notice_period', 'payment_pending')
    group by tenant.phone
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce global tenancy rule: duplicate active tenant phone numbers already exist';
  end if;

  if exists (
    select lower(btrim(tenant.email))
    from public.tenants tenant
    where tenant.email is not null
      and btrim(tenant.email) <> ''
      and tenant.status in ('active', 'notice_period', 'payment_pending')
    group by lower(btrim(tenant.email))
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce global tenancy rule: duplicate active tenant email addresses already exist';
  end if;
end;
$$;

create unique index if not exists tenants_one_active_user_global_idx
  on public.tenants (user_id)
  where user_id is not null
    and status in ('active', 'notice_period', 'payment_pending');

create unique index if not exists tenants_one_active_phone_global_idx
  on public.tenants (phone)
  where phone is not null
    and btrim(phone) <> ''
    and status in ('active', 'notice_period', 'payment_pending');

create unique index if not exists tenants_one_active_email_global_idx
  on public.tenants (lower(btrim(email)))
  where email is not null
    and btrim(email) <> ''
    and status in ('active', 'notice_period', 'payment_pending');

create or replace function public.approve_application_atomic(
  p_application_id uuid,
  p_user_id uuid
)
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
  deposit_amount numeric;
begin
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  select * into application_record
  from public.applications
  where id = p_application_id
  for update;

  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;
  if application_record.payment_screenshot is null
    or nullif(trim(application_record.payment_transaction_id), '') is null
  then
    raise exception 'Application payment proof is required';
  end if;

  select owner_id into property_owner
  from public.properties
  where id = application_record.property_id;

  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record
  from public.rooms
  where id = application_record.room_id
    and property_id = application_record.property_id
  for update;

  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then
    raise exception 'The selected room is full';
  end if;

  deposit_amount := greatest(
    0,
    coalesce(application_record.payment_amount, room_record.deposit_amount, 0)
  );
  if deposit_amount <= 0 then raise exception 'Application deposit amount is invalid'; end if;

  if exists (
    select 1
    from public.tenants tenant
    where (
        tenant.user_id = p_user_id
        or tenant.phone = application_record.phone
        or lower(tenant.email) = lower(application_record.email)
      )
      and tenant.status in ('active', 'notice_period', 'payment_pending')
  ) then
    raise exception 'Applicant already has a tenant record';
  end if;

  insert into public.tenants (
    user_id,
    property_id,
    room_id,
    name,
    phone,
    email,
    blood_group,
    rent_amount,
    pending_amount,
    total_paid,
    rent_status,
    move_in_date,
    status,
    payment_screenshot,
    upi_transaction_id,
    security_deposit_amount,
    security_deposit_status,
    security_deposit_refund_status,
    profile_photo_path
  ) values (
    p_user_id,
    application_record.property_id,
    application_record.room_id,
    application_record.name,
    application_record.phone,
    application_record.email,
    application_record.blood_group,
    room_record.monthly_rent,
    room_record.monthly_rent,
    0,
    'pending',
    current_date,
    'active',
    application_record.payment_screenshot,
    application_record.payment_transaction_id,
    deposit_amount,
    'paid',
    'not_refunded',
    case
      when application_record.photo like application_record.property_id::text || '/photos/%'
        and application_record.photo !~ '(^/|\\.\\.|//|[?#])'
      then application_record.photo
      else null
    end
  )
  returning id into tenant_id;

  insert into public.payment_history (
    tenant_id,
    amount,
    payment_date,
    payment_method,
    status,
    upi_transaction_id,
    payment_screenshot
  ) values (
    tenant_id,
    deposit_amount,
    current_date,
    'security_deposit',
    'success',
    application_record.payment_transaction_id,
    application_record.payment_screenshot
  );

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case
        when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied'
        else 'vacant'
      end,
      updated_at = now()
  where id = room_record.id;

  update public.applications
  set status = 'approved',
      user_id = p_user_id,
      processed_at = now(),
      updated_at = now()
  where id = application_record.id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', tenant_id,
    'email', application_record.email
  );
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
begin
  select * into application_record
  from public.applications
  where id = p_application_id;

  if application_record.id is null then raise exception 'Application not found'; end if;
  return public.approve_application_atomic(p_application_id, application_record.user_id);
end;
$$;

revoke all on function public.approve_application_atomic(uuid, uuid) from public, anon;
revoke all on function public.approve_application_atomic(uuid) from public, anon;
grant execute on function public.approve_application_atomic(uuid, uuid) to authenticated;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
