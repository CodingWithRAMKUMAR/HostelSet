-- Prevent owner-recorded rent collections from exceeding the tenant's
-- currently outstanding rent.
--
-- Partial owner collections remain supported.
-- Duplicate request IDs remain idempotent.
-- Tenant online-payment behavior is unchanged.

create or replace function public.record_owner_rent_collection(
  p_tenant_id uuid,
  p_amount numeric,
  p_collection_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  tenant_record public.tenants%rowtype;
  property_owner uuid;
  outstanding_amount numeric := 0;
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

  outstanding_amount :=
    public.refresh_tenant_rent_summary(tenant_record.id);

  outstanding_amount := round(outstanding_amount);

  if outstanding_amount <= 0 then
    raise exception 'No outstanding rent is available for collection';
  end if;

  if p_amount > outstanding_amount then
    raise exception
      'Collection amount cannot exceed outstanding rent of ₹%',
      outstanding_amount;
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
    'collected_amount', p_amount::integer,
    'pending_amount', new_pending
  );
end;
$function$;

revoke all
on function public.record_owner_rent_collection(uuid, numeric, uuid)
from public, anon;

grant execute
on function public.record_owner_rent_collection(uuid, numeric, uuid)
to authenticated;

