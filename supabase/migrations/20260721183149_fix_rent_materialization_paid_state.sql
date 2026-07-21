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
      tenant.rent_amount::numeric(12, 2) as amount,      case
        when tenant.paid_through_date is not null
          and tenant.paid_through_date >= (
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
          )::date
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

