-- Require settled current rent before a tenant can request vacating.
-- The trigger protects every insert path; the RPC creates the request and rating atomically.

create or replace function public.enforce_vacate_rent_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
begin
  select * into tenant_record
  from public.tenants
  where id = new.tenant_id
  for update;

  if tenant_record.id is null then raise exception 'Tenant not found'; end if;
  if tenant_record.property_id is distinct from new.property_id
    or tenant_record.room_id is distinct from new.room_id then
    raise exception 'Vacate request does not match the tenant room';
  end if;
  if new.expected_check_out < current_date then
    raise exception 'Expected check-out date cannot be in the past';
  end if;
  if exists (
    select 1 from public.check_out_requests request
    where request.tenant_id = new.tenant_id
      and request.status in ('pending', 'approved')
  ) then
    raise exception 'You already have an active vacate request.';
  end if;
  if exists (
    select 1 from public.payment_history payment
    where payment.tenant_id = new.tenant_id
      and payment.status = 'payment_pending'
  ) then
    raise exception 'Your latest payment is awaiting owner verification.';
  end if;
  if coalesce(tenant_record.pending_amount, 0) > 0
    or tenant_record.rent_status is distinct from 'paid'
    or exists (
      select 1 from public.rent_records rent
      where rent.tenant_id = new.tenant_id
        and rent.status = 'unpaid'
        and rent.period_start <= date_trunc('month', current_date)::date
    )
    or exists (
      select 1 from public.rent_records rent
      where rent.tenant_id = new.tenant_id
        and rent.status = 'unpaid'
        and rent.due_date < current_date
    ) then
    raise exception 'Outstanding rent must be cleared before requesting vacate.';
  end if;

  return new;
end;
$$;

drop trigger if exists check_out_requests_rent_eligibility on public.check_out_requests;
create trigger check_out_requests_rent_eligibility
before insert on public.check_out_requests
for each row execute function public.enforce_vacate_rent_eligibility();

create or replace function public.request_tenant_vacate(
  p_expected_check_out date,
  p_reason text,
  p_rating integer,
  p_review text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  request_id uuid;
  tenant_room_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_expected_check_out is null then raise exception 'Expected check-out date is required'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if length(coalesce(p_reason, '')) > 2000 then raise exception 'Reason is too long'; end if;
  if length(coalesce(p_review, '')) > 2000 then raise exception 'Review is too long'; end if;

  select * into tenant_record
  from public.tenants
  where user_id = auth.uid()
    and status in ('active', 'notice_period', 'payment_pending')
  for update;

  if tenant_record.id is null then raise exception 'Active tenant record not found'; end if;

  select room_number into tenant_room_number
  from public.rooms where id = tenant_record.room_id;

  insert into public.check_out_requests (
    tenant_id, tenant_name, property_id, room_id, room_number,
    expected_check_out, reason, requested_date, status
  ) values (
    tenant_record.id, tenant_record.name, tenant_record.property_id,
    tenant_record.room_id, coalesce(tenant_room_number, 'N/A'),
    p_expected_check_out, nullif(trim(p_reason), ''), current_date, 'pending'
  ) returning id into request_id;

  insert into public.ratings (tenant_id, property_id, rating, review)
  values (
    tenant_record.id, tenant_record.property_id, p_rating,
    nullif(trim(p_review), '')
  );

  return jsonb_build_object('success', true, 'request_id', request_id);
end;
$$;

revoke all on function public.enforce_vacate_rent_eligibility() from public, anon, authenticated;
revoke all on function public.request_tenant_vacate(date, text, integer, text) from public, anon;
grant execute on function public.request_tenant_vacate(date, text, integer, text) to authenticated;
