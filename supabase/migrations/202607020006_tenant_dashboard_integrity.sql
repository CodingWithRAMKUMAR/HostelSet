-- Tenant profile updates are restricted to identity-safe fields, and tenant
-- payment-proof submission is serialized to prevent duplicate pending proofs.

create or replace function public.update_tenant_profile(
  p_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_id uuid;
  clean_name text := nullif(trim(p_name), '');
  clean_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if clean_name is null or length(clean_name) > 120 then raise exception 'A valid name is required'; end if;
  if clean_phone is not null and clean_phone !~ '^[0-9]{10}$' then raise exception 'Phone must contain 10 digits'; end if;

  update public.tenants
  set name = clean_name, phone = clean_phone
  where user_id = auth.uid()
    and status in ('active', 'notice_period', 'payment_pending')
  returning id into tenant_id;

  if tenant_id is null then raise exception 'Active tenant record not found'; end if;

  update public.users
  set full_name = clean_name, phone = clean_phone
  where id = auth.uid();

  return jsonb_build_object('success', true, 'tenant_id', tenant_id);
end;
$$;

revoke all on function public.update_tenant_profile(text, text) from public, anon;
grant execute on function public.update_tenant_profile(text, text) to authenticated;

create or replace function public.protect_tenant_managed_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.user_id and (
    new.user_id is distinct from old.user_id
    or new.property_id is distinct from old.property_id
    or new.room_id is distinct from old.room_id
    or new.email is distinct from old.email
    or new.rent_amount is distinct from old.rent_amount
    or new.pending_amount is distinct from old.pending_amount
    or new.total_paid is distinct from old.total_paid
    or new.rent_status is distinct from old.rent_status
    or new.last_payment_date is distinct from old.last_payment_date
    or new.payment_screenshot is distinct from old.payment_screenshot
    or new.upi_transaction_id is distinct from old.upi_transaction_id
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'Tenant-managed room, rent, payment, email and archive fields cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_tenant_managed_fields() from public, anon, authenticated;
drop trigger if exists tenants_protect_managed_fields on public.tenants;
create trigger tenants_protect_managed_fields
before update on public.tenants
for each row execute function public.protect_tenant_managed_fields();

create or replace function public.enforce_tenant_pending_payment_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_user_id uuid;
begin
  select user_id into tenant_user_id
  from public.tenants
  where id = new.tenant_id
  for update;

  if tenant_user_id = auth.uid() and new.status = 'payment_pending' then
    if nullif(trim(new.upi_transaction_id), '') is null then
      raise exception 'UPI transaction ID is required';
    end if;
    if nullif(trim(new.payment_screenshot), '') is null then
      raise exception 'Payment screenshot is required';
    end if;
    if exists (
      select 1 from public.payment_history payment
      where payment.tenant_id = new.tenant_id
        and payment.status = 'payment_pending'
    ) then
      raise exception 'A payment proof is already waiting for owner confirmation.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_tenant_pending_payment_submission() from public, anon, authenticated;
drop trigger if exists tenant_pending_payment_submission on public.payment_history;
create trigger tenant_pending_payment_submission
before insert on public.payment_history
for each row execute function public.enforce_tenant_pending_payment_submission();
