-- Final-room rent rule for repeated room changes.
--
-- Rules:
-- 1. The current cycle always equals the tenant's final/current room rent.
-- 2. Already received or credited money remains preserved.
-- 3. Higher rent creates only the remaining difference.
-- 4. Lower rent immediately reduces the current-cycle obligation.
-- 5. Future unpaid cycles use the new room rent.
-- 6. Repeated room changes cannot accumulate intermediate room rents.

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

  previous_rent numeric;
  current_received numeric;
  resulting_pending numeric;
begin
  select *
  into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if tenant_record.id is null then
    raise exception 'Tenant not found';
  end if;

  if tenant_record.room_id <> p_old_room_id then
    raise exception 'Tenant room changed; refresh and retry';
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

  if old_room.id is null
    or new_room.id is null
    or old_room.property_id <> tenant_record.property_id
    or new_room.property_id <> tenant_record.property_id then
    raise exception 'Invalid room';
  end if;

  if old_room.id = new_room.id then
    raise exception 'Tenant is already assigned to this room';
  end if;

  if new_room.current_occupants >= new_room.capacity then
    raise exception 'Requested room is full';
  end if;

  previous_rent := tenant_record.rent_amount;

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

  -- Materialize the current cycle when it does not already exist.
  --
  -- For a legacy tenant already marked paid, the old room rent becomes
  -- opening credit. This preserves the amount already satisfied before
  -- changing the cycle to the new final-room rent.
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
    previous_rent,
    case
      when coalesce(tenant_record.pending_amount, 0) <= 0
        and tenant_record.rent_status = 'paid'
      then 'paid'
      else 'unpaid'
    end,
    case
      when coalesce(tenant_record.pending_amount, 0) <= 0
        and tenant_record.rent_status = 'paid'
      then previous_rent
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

  if current_record.id is null then
    raise exception 'Current rent cycle could not be created';
  end if;

  current_received :=
    coalesce(
      public.rent_record_received_amount(current_record.id),
      0
    );

  -- Final-room rule:
  -- Never keep the highest intermediate room rent and never add each
  -- room-change difference. The cycle amount always becomes exactly
  -- the newly selected room's monthly rent.
  update public.rent_records
  set amount = new_room.monthly_rent,
      status = case
        when current_received >= new_room.monthly_rent
          then 'paid'
        else 'unpaid'
      end,
      paid_at = case
        when current_received >= new_room.monthly_rent
          then coalesce(paid_at, now())
        else null
      end,
      updated_at = now()
  where id = current_record.id;

  perform public.reconcile_rent_record(current_record.id);

  -- All future unpaid cycles use the new final-room rent.
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
    'previous_rent', previous_rent,
    'new_rent', new_room.monthly_rent,
    'current_cycle_amount', new_room.monthly_rent,
    'current_cycle_received', current_received,
    'pending_amount', resulting_pending
  );
end;
$$;

revoke all on function public.move_tenant_room(uuid, uuid, uuid)
  from public, anon;

grant execute on function public.move_tenant_room(uuid, uuid, uuid)
  to authenticated;


-- Repair existing current-cycle records produced by the old highest-rent rule.
--
-- The current cycle is reset to each tenant's final/current room rent.
-- Existing credits and linked payments remain untouched.
update public.rent_records rent
set amount = tenant.rent_amount,
    updated_at = now()
from public.tenants tenant
where rent.tenant_id = tenant.id
  and rent.period_start = date_trunc('month', current_date)::date
  and rent.status <> 'cancelled'
  and tenant.status in ('active', 'notice_period', 'payment_pending')
  and rent.amount is distinct from tenant.rent_amount;

do $$
declare
  rent_record record;
  tenant_record record;
begin
  for rent_record in
    select rent.id
    from public.rent_records rent
    join public.tenants tenant
      on tenant.id = rent.tenant_id
    where rent.period_start = date_trunc('month', current_date)::date
      and rent.status <> 'cancelled'
      and tenant.status in ('active', 'notice_period', 'payment_pending')
  loop
    perform public.reconcile_rent_record(rent_record.id);
  end loop;

  for tenant_record in
    select tenant.id
    from public.tenants tenant
    where tenant.status in ('active', 'notice_period', 'payment_pending')
  loop
    perform public.refresh_tenant_rent_summary(tenant_record.id);
  end loop;
end;
$$;
