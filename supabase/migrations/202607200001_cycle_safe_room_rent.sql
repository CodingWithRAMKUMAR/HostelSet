-- Cycle-safe rent accounting and room-change pricing.
--
-- Rules:
-- 1. Every monthly rent cycle has exactly one rent_records row.
-- 2. A rent cycle is paid only when cycle-specific credit plus successful
--    payments linked to that cycle cover its amount.
-- 3. Existing paid records are preserved as a cutover baseline without
--    guessing which historical unlinked payment belonged to which cycle.
-- 4. A higher room rent adds only the difference to the current cycle.
-- 5. A lower room rent starts from the next monthly cycle.
-- 6. paid_through_date is never advanced by these functions.

alter table public.rent_records
  add column if not exists credited_amount numeric(12, 2) not null default 0;

alter table public.rent_records
  drop constraint if exists rent_records_credited_amount_check;

alter table public.rent_records
  add constraint rent_records_credited_amount_check
  check (credited_amount >= 0);

comment on column public.rent_records.credited_amount is
  'Opening credit accepted for this exact cycle. Used for imported or legacy paid-cycle cutover state; new HostelSet payments remain in payment_history.';

-- Preserve the existing paid/unpaid state at migration cutover without
-- attaching historically ambiguous payment_history rows.
--
-- For a paid record that already has linked successful payments, credit only
-- the uncovered remainder so:
--
-- credited_amount + linked successful payments = at least rent amount.
update public.rent_records rent
set credited_amount = greatest(
  rent.amount - coalesce((
    select sum(payment.amount)::numeric
    from public.payment_history payment
    where payment.rent_id = rent.id
      and payment.status = 'success'
      and payment.payment_method is distinct from 'security_deposit'
  ), 0),
  0
)
where rent.status = 'paid'
  and rent.credited_amount = 0;

create or replace function public.rent_record_received_amount(
  p_rent_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(rent.credited_amount, 0)
    + coalesce((
        select sum(payment.amount)::numeric
        from public.payment_history payment
        where payment.rent_id = rent.id
          and payment.status = 'success'
          and payment.payment_method is distinct from 'security_deposit'
      ), 0)
  from public.rent_records rent
  where rent.id = p_rent_id;
$$;

create or replace function public.refresh_tenant_rent_summary(
  p_tenant_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  outstanding_amount numeric := 0;
  oldest_due_date date;
begin
  select
    coalesce(sum(
      greatest(
        rent.amount - public.rent_record_received_amount(rent.id),
        0
      )
    ), 0),
    min(rent.due_date) filter (
      where public.rent_record_received_amount(rent.id) < rent.amount
    )
  into outstanding_amount, oldest_due_date
  from public.rent_records rent
  where rent.tenant_id = p_tenant_id
    and rent.status <> 'cancelled'
    and rent.period_start <= date_trunc('month', current_date)::date;

  update public.tenants
  set pending_amount = round(outstanding_amount)::integer,
      rent_status = case
        when outstanding_amount <= 0 then 'paid'
        when oldest_due_date < current_date then 'overdue'
        else 'pending'
      end,
      updated_at = now()
  where id = p_tenant_id
    and status in ('active', 'notice_period', 'payment_pending');

  return outstanding_amount;
end;
$$;

create or replace function public.reconcile_rent_record(
  p_rent_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  rent_record public.rent_records%rowtype;
  received_amount numeric := 0;
begin
  select *
  into rent_record
  from public.rent_records
  where id = p_rent_id
  for update;

  if rent_record.id is null then
    return 0;
  end if;

  if rent_record.status = 'cancelled' then
    return public.rent_record_received_amount(rent_record.id);
  end if;

  received_amount :=
    coalesce(public.rent_record_received_amount(rent_record.id), 0);

  update public.rent_records
  set status = case
        when received_amount >= amount then 'paid'
        else 'unpaid'
      end,
      paid_at = case
        when received_amount >= amount
          then coalesce(paid_at, now())
        else null
      end,
      updated_at = now()
  where id = rent_record.id;

  return received_amount;
end;
$$;

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
    select rent.id
    into new.rent_id
    from public.rent_records rent
    where rent.tenant_id = new.tenant_id
      and rent.status <> 'cancelled'
      and public.rent_record_received_amount(rent.id) < rent.amount
    order by rent.due_date, rent.created_at, rent.id
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
begin
  if new.payment_method = 'security_deposit' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.rent_id is distinct from new.rent_id
    and old.rent_id is not null then
    perform public.reconcile_rent_record(old.rent_id);
  end if;

  if new.rent_id is not null
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
      or old.amount is distinct from new.amount
      or old.rent_id is distinct from new.rent_id
    ) then
    perform public.reconcile_rent_record(new.rent_id);
  end if;

  perform public.refresh_tenant_rent_summary(new.tenant_id);

  return new;
end;
$$;

-- Tenant updates must never mark rent records paid from the tenant-level
-- balance. Only cycle-specific reconciliation may mark a cycle paid.
create or replace function public.sync_paid_tenant_rent_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('active', 'notice_period', 'payment_pending') then
    update public.rent_records
    set status = 'cancelled',
        paid_at = null,
        updated_at = now()
    where tenant_id = new.id
      and status = 'unpaid';
  end if;

  return new;
end;
$$;

create or replace function public.materialize_monthly_rent_records(
  p_reference_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer;
begin
  with months as (
    select generate_series(
      date_trunc('month', p_reference_date)::date,
      (date_trunc('month', p_reference_date) + interval '1 month')::date,
      interval '1 month'
    )::date as period_start
  ),
  candidate_rents as (
    select
      tenant.id as tenant_id,
      property.owner_id,
      month.period_start,
      (
        month.period_start + interval '1 month - 1 day'
      )::date as period_end,
      (
        month.period_start
        + (
          least(
            extract(day from tenant.move_in_date)::integer,
            extract(
              day from (
                month.period_start + interval '1 month - 1 day'
              )
            )::integer
          ) - 1
        ) * interval '1 day'
      )::date as due_date,
      tenant.rent_amount::numeric(12, 2) as amount,
      case
        when month.period_start =
             date_trunc('month', p_reference_date)::date
          and coalesce(tenant.pending_amount, 0) <= 0
          and tenant.rent_status = 'paid'
        then 'paid'
        else 'unpaid'
      end as rent_status
    from public.tenants tenant
    join public.properties property
      on property.id = tenant.property_id
    cross join months month
    where tenant.status in ('active', 'notice_period', 'payment_pending')
      and tenant.move_in_date is not null
      and coalesce(tenant.rent_amount, 0) > 0
      and month.period_start >=
          date_trunc('month', tenant.move_in_date)::date
  )
  insert into public.rent_records (
    tenant_id,
    owner_id,
    period_start,
    period_end,
    due_date,
    amount,
    status,
    credited_amount,
    paid_at
  )
  select
    tenant_id,
    owner_id,
    period_start,
    period_end,
    due_date,
    amount,
    rent_status,
    case when rent_status = 'paid' then amount else 0 end,
    case when rent_status = 'paid' then now() else null end
  from candidate_rents
  on conflict (tenant_id, period_start) do update
  set owner_id = excluded.owner_id,
      amount = excluded.amount,
      period_end = excluded.period_end,
      due_date = excluded.due_date,
      updated_at = now()
  where public.rent_records.status = 'unpaid'
    and public.rent_records.period_start >
        date_trunc('month', p_reference_date)::date;

  get diagnostics affected_count = row_count;
  return affected_count;
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
  select *
  into payment_record
  from public.payment_history
  where id = p_payment_id
  for update;

  if payment_record.id is null then
    raise exception 'Payment not found';
  end if;

  if payment_record.status <> 'payment_pending' then
    raise exception 'Payment has already been reviewed';
  end if;

  select *
  into tenant_record
  from public.tenants
  where id = payment_record.tenant_id
  for update;

  if tenant_record.id is null then
    raise exception 'Tenant not found';
  end if;

  select owner_id
  into property_owner
  from public.properties
  where id = tenant_record.property_id;

  if property_owner is distinct from auth.uid()
    and not public.is_hostelset_admin() then
    raise exception 'Not authorized to review this payment';
  end if;

  is_deposit := payment_record.payment_method = 'security_deposit';

  if not p_approve then
    if is_deposit then
      update public.tenants
      set security_deposit_status = case
            when security_deposit_amount > 0 then 'pending'
            else 'not_required'
          end,
          updated_at = now()
      where id = tenant_record.id;
    end if;

    delete from public.payment_history
    where id = p_payment_id;

    return jsonb_build_object(
      'success', true,
      'status', 'rejected'
    );
  end if;

  if is_deposit then
    update public.tenants
    set security_deposit_amount =
          greatest(security_deposit_amount, payment_record.amount),
        security_deposit_status = 'paid',
        security_deposit_refund_status = 'not_refunded',
        updated_at = now()
    where id = tenant_record.id;

    update public.payment_history
    set status = 'success'
    where id = p_payment_id;

    return jsonb_build_object(
      'success', true,
      'status', 'success',
      'payment_type', 'security_deposit'
    );
  end if;

  update public.payment_history
  set status = 'success'
  where id = p_payment_id;

  update public.tenants
  set total_paid = coalesce(total_paid, 0) + payment_record.amount,
      last_payment_date = current_date,
      updated_at = now()
  where id = tenant_record.id;

  new_pending :=
    public.refresh_tenant_rent_summary(tenant_record.id);

  return jsonb_build_object(
    'success', true,
    'status', 'success',
    'payment_type', 'rent',
    'pending_amount', new_pending
  );
end;
$$;

create or replace function public.record_owner_rent_collection(
  p_tenant_id uuid,
  p_amount numeric,
  p_collection_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  property_owner uuid;
  new_pending numeric;
begin
  if p_collection_id is null then
    raise exception 'Collection ID is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Collection amount must be greater than zero';
  end if;

  if p_amount <> trunc(p_amount) then
    raise exception 'Collection amount must be a whole rupee value';
  end if;

  select *
  into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if tenant_record.id is null then
    raise exception 'Tenant not found';
  end if;

  if tenant_record.status not in (
    'active',
    'notice_period',
    'payment_pending'
  ) then
    raise exception 'Tenant is not active';
  end if;

  select owner_id
  into property_owner
  from public.properties
  where id = tenant_record.property_id;

  if property_owner is distinct from auth.uid()
    and not public.is_hostelset_admin() then
    raise exception 'Not authorized to collect rent for this tenant';
  end if;

  if exists (
    select 1
    from public.payment_history
    where id = p_collection_id
  ) then
    if exists (
      select 1
      from public.payment_history
      where id = p_collection_id
        and tenant_id = tenant_record.id
        and payment_method = 'owner_collection'
        and status = 'success'
    ) then
      return jsonb_build_object(
        'success', true,
        'duplicate', true
      );
    end if;

    raise exception 'Collection ID has already been used';
  end if;

  insert into public.payment_history (
    id,
    tenant_id,
    amount,
    payment_date,
    payment_method,
    status
  )
  values (
    p_collection_id,
    tenant_record.id,
    p_amount::integer,
    current_date,
    'owner_collection',
    'success'
  );

  update public.tenants
  set total_paid = coalesce(total_paid, 0) + p_amount::integer,
      last_payment_date = current_date,
      updated_at = now()
  where id = tenant_record.id;

  new_pending :=
    public.refresh_tenant_rent_summary(tenant_record.id);

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'pending_amount', new_pending
  );
end;
$$;

create or replace function public.move_tenant_room(
  p_tenant_id uuid,
  p_new_room_id uuid,
  p_old_room_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  old_room public.rooms%rowtype;
  new_room public.rooms%rowtype;
  property_owner uuid;
  current_period_start date;
  current_period_end date;
  current_due_date date;
  current_record public.rent_records%rowtype;
  rent_difference numeric;
  current_received numeric;
  resulting_pending numeric;
begin
  select *
  into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if tenant_record.id is null
    or tenant_record.room_id <> p_old_room_id then
    raise exception 'Tenant room changed; refresh and retry';
  end if;

  select owner_id
  into property_owner
  from public.properties
  where id = tenant_record.property_id;

  if property_owner is distinct from auth.uid()
    and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select *
  into old_room
  from public.rooms
  where id = p_old_room_id
  for update;

  select *
  into new_room
  from public.rooms
  where id = p_new_room_id
  for update;

  if new_room.id is null
    or old_room.id is null
    or new_room.property_id <> tenant_record.property_id
    or old_room.property_id <> tenant_record.property_id then
    raise exception 'Invalid room';
  end if;

  if new_room.id = old_room.id then
    raise exception 'Tenant is already assigned to this room';
  end if;

  if new_room.current_occupants >= new_room.capacity then
    raise exception 'Requested room is full';
  end if;

  current_period_start :=
    date_trunc('month', current_date)::date;

  current_period_end :=
    (current_period_start + interval '1 month - 1 day')::date;

  current_due_date := (
    current_period_start
    + (
      least(
        extract(day from tenant_record.move_in_date)::integer,
        extract(day from current_period_end)::integer
      ) - 1
    ) * interval '1 day'
  )::date;

  insert into public.rent_records (
    tenant_id,
    owner_id,
    period_start,
    period_end,
    due_date,
    amount,
    status,
    credited_amount,
    paid_at
  )
  values (
    tenant_record.id,
    property_owner,
    current_period_start,
    current_period_end,
    current_due_date,
    tenant_record.rent_amount,
    case
      when coalesce(tenant_record.pending_amount, 0) <= 0
        and tenant_record.rent_status = 'paid'
      then 'paid'
      else 'unpaid'
    end,
    case
      when coalesce(tenant_record.pending_amount, 0) <= 0
        and tenant_record.rent_status = 'paid'
      then tenant_record.rent_amount
      else 0
    end,
    case
      when coalesce(tenant_record.pending_amount, 0) <= 0
        and tenant_record.rent_status = 'paid'
      then now()
      else null
    end
  )
  on conflict (tenant_id, period_start) do nothing;

  select *
  into current_record
  from public.rent_records
  where tenant_id = tenant_record.id
    and period_start = current_period_start
  for update;

  rent_difference :=
    new_room.monthly_rent - tenant_record.rent_amount;

  -- Higher rent: add only this month's difference.
  if rent_difference > 0 then
    current_received :=
      coalesce(
        public.rent_record_received_amount(current_record.id),
        0
      );

    -- Preserve an already-paid legacy current cycle as the old-rent baseline.
    if current_record.status = 'paid'
      and current_received < current_record.amount then
      update public.rent_records
      set credited_amount =
            credited_amount + (current_record.amount - current_received),
          updated_at = now()
      where id = current_record.id;
    end if;

    update public.rent_records
    set amount = greatest(amount, new_room.monthly_rent),
        status = 'unpaid',
        paid_at = null,
        updated_at = now()
    where id = current_record.id;

    perform public.reconcile_rent_record(current_record.id);
  end if;

  -- Higher or lower rent: all not-yet-started cycles use the new room rent.
  update public.rent_records
  set amount = new_room.monthly_rent,
      updated_at = now()
  where tenant_id = tenant_record.id
    and period_start > current_period_start
    and status = 'unpaid';

  update public.tenants
  set room_id = new_room.id,
      rent_amount = new_room.monthly_rent,
      updated_at = now()
  where id = tenant_record.id;

  update public.rooms
  set current_occupants =
        greatest(0, current_occupants - 1),
      status = case
        when greatest(0, current_occupants - 1) >= capacity
          then 'occupied'
        else 'vacant'
      end,
      updated_at = now()
  where id = old_room.id;

  update public.rooms
  set current_occupants = current_occupants + 1,
      status = case
        when current_occupants + 1 >= capacity
          then 'occupied'
        else 'vacant'
      end,
      updated_at = now()
  where id = new_room.id;

  update public.room_change_requests
  set status = 'approved',
      processed_at = now(),
      rejection_reason = null,
      updated_at = now()
  where tenant_id = tenant_record.id
    and old_room_id = old_room.id
    and new_room_id = new_room.id
    and status = 'pending';

  update public.check_out_requests
  set status = 'cancelled',
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where tenant_id = tenant_record.id
    and status in ('pending', 'approved');

  resulting_pending :=
    public.refresh_tenant_rent_summary(tenant_record.id);

  return jsonb_build_object(
    'success', true,
    'room_id', new_room.id,
    'previous_rent', tenant_record.rent_amount,
    'new_rent', new_room.monthly_rent,
    'current_cycle_difference', greatest(rent_difference, 0),
    'pending_amount', resulting_pending
  );
end;
$$;

revoke all on function public.rent_record_received_amount(uuid)
  from public, anon;

revoke all on function public.refresh_tenant_rent_summary(uuid)
  from public, anon;

revoke all on function public.reconcile_rent_record(uuid)
  from public, anon;

