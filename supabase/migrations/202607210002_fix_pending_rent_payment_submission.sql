-- Fix tenant payment-proof submission being rejected by tenant-field protection.
--
-- Root cause:
-- sync_successful_payment_to_rent_record() ran after every payment INSERT,
-- including payment_pending tenant submissions, and unconditionally refreshed
-- tenants.pending_amount / tenants.rent_status.
--
-- Correct behavior:
-- 1. Pending payment proofs do not affect rent balances.
-- 2. Successful payments reconcile the linked rent cycle.
-- 3. Changes away from success reverse/recalculate the old successful payment.
-- 4. Security-deposit payments remain outside monthly-rent reconciliation.

create or replace function public.sync_successful_payment_to_rent_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_tenant_id uuid;
  new_tenant_id uuid;
begin
  -- Security deposits are not monthly-rent payments.
  if new.payment_method = 'security_deposit' then
    return new;
  end if;

  new_tenant_id := new.tenant_id;

  if tg_op = 'INSERT' then
    -- A tenant-submitted payment_pending proof must not change rent summaries.
    if new.status is distinct from 'success' then
      return new;
    end if;

    if new.rent_id is not null then
      perform public.reconcile_rent_record(new.rent_id);
    end if;

    perform public.refresh_tenant_rent_summary(new_tenant_id);

    return new;
  end if;

  old_tenant_id := old.tenant_id;

  -- Recalculate the previously linked cycle when a successful payment is
  -- moved, changed, or changed away from success.
  if old.status = 'success'
     and old.rent_id is not null
     and (
       new.status is distinct from old.status
       or new.rent_id is distinct from old.rent_id
       or new.amount is distinct from old.amount
       or new.tenant_id is distinct from old.tenant_id
     ) then
    perform public.reconcile_rent_record(old.rent_id);
  end if;

  -- Recalculate the current cycle when the resulting payment is successful.
  if new.status = 'success'
     and new.rent_id is not null
     and (
       old.status is distinct from new.status
       or old.rent_id is distinct from new.rent_id
       or old.amount is distinct from new.amount
       or old.tenant_id is distinct from new.tenant_id
     ) then
    perform public.reconcile_rent_record(new.rent_id);
  end if;

  -- Refresh summaries only when a successful payment was involved.
  if old.status = 'success' or new.status = 'success' then
    if old_tenant_id is not null then
      perform public.refresh_tenant_rent_summary(old_tenant_id);
    end if;

    if new_tenant_id is distinct from old_tenant_id then
      perform public.refresh_tenant_rent_summary(new_tenant_id);
    end if;
  end if;

  return new;
end;
$$;
