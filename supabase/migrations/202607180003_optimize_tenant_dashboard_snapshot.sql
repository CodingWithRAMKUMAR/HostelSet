-- Execute the tenant dashboard snapshot through a private, fixed-shape helper.
--
-- The public RPC remains SECURITY INVOKER and keeps the same no-argument API.
-- The private helper is SECURITY DEFINER so its already tenant-scoped reads do
-- not repeatedly evaluate tenant, owner, and admin RLS policies on every table.
-- It accepts no user-controlled identifiers and every row is scoped from the
-- trusted JWT identity returned by auth.uid().

create schema if not exists hostelset_private;

revoke all on schema hostelset_private from public, anon;
grant usage on schema hostelset_private to authenticated;

create or replace function hostelset_private.get_my_tenant_dashboard_snapshot_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with request_identity as (
    select (select auth.uid()) as user_id
  ),
  current_tenant as (
    select tenant_row.*
    from public.tenants as tenant_row
    where tenant_row.user_id = (
      select identity_row.user_id
      from request_identity as identity_row
    )
    limit 1
  ),
  tenant_with_relations as (
    select
      to_jsonb(tenant_row)
      || jsonb_build_object(
        'rooms', to_jsonb(room_row),
        'property', to_jsonb(property_row)
      ) as value
    from current_tenant as tenant_row
    left join public.rooms as room_row
      on room_row.id = tenant_row.room_id
    left join public.properties as property_row
      on property_row.id = tenant_row.property_id
  )
  select jsonb_build_object(
    'snapshot_version', 1,
    'loaded_at', timezone('utc', now()),
    'role', (
      select user_row.role
      from public.users as user_row
      where user_row.id = (
        select identity_row.user_id
        from request_identity as identity_row
      )
      limit 1
    ),
    'tenant', (
      select tenant_data.value
      from tenant_with_relations as tenant_data
      limit 1
    ),
    'owner', (
      select jsonb_build_object(
        'full_name', owner_row.full_name,
        'phone', owner_row.phone,
        'email', owner_row.email
      )
      from current_tenant as tenant_row
      join public.properties as property_row
        on property_row.id = tenant_row.property_id
      join public.users as owner_row
        on owner_row.id = property_row.owner_id
      limit 1
    ),
    'payments', (
      select coalesce(
        jsonb_agg(to_jsonb(payment_row) order by payment_row.payment_date desc),
        '[]'::jsonb
      )
      from public.payment_history as payment_row
      where payment_row.tenant_id = (
        select tenant_row.id
        from current_tenant as tenant_row
        limit 1
      )
    ),
    'owner_settings', (
      select jsonb_build_object(
        'upi_id', settings_row.upi_id,
        'upi_phone', settings_row.upi_phone
      )
      from public.owner_settings as settings_row
      where settings_row.property_id = (
        select tenant_row.property_id
        from current_tenant as tenant_row
        limit 1
      )
      limit 1
    ),
    'notices', (
      select coalesce(
        jsonb_agg(to_jsonb(notice_row) order by notice_row.created_at desc),
        '[]'::jsonb
      )
      from (
        select notice_source.*
        from public.notices as notice_source
        where notice_source.property_id = (
          select tenant_row.property_id
          from current_tenant as tenant_row
          limit 1
        )
        or notice_source.property_id is null
        order by notice_source.created_at desc
        limit 10
      ) as notice_row
    ),
    'complaints', (
      select coalesce(
        jsonb_agg(to_jsonb(complaint_row) order by complaint_row.created_at desc),
        '[]'::jsonb
      )
      from public.complaints as complaint_row
      where complaint_row.tenant_id = (
        select tenant_row.id
        from current_tenant as tenant_row
        limit 1
      )
    ),
    'vacate_requests', (
      select coalesce(
        jsonb_agg(to_jsonb(vacate_row) order by vacate_row.created_at desc),
        '[]'::jsonb
      )
      from (
        select vacate_source.*
        from public.check_out_requests as vacate_source
        where vacate_source.tenant_id = (
          select tenant_row.id
          from current_tenant as tenant_row
          limit 1
        )
        order by vacate_source.created_at desc
        limit 10
      ) as vacate_row
    ),
    'pending_room_change', (
      select to_jsonb(room_change_row)
      from public.room_change_requests as room_change_row
      where room_change_row.tenant_id = (
        select tenant_row.id
        from current_tenant as tenant_row
        limit 1
      )
      and room_change_row.status = 'pending'
      order by room_change_row.requested_at desc
      limit 1
    ),
    'last_room_change_decision', (
      select jsonb_build_object(
        'id', room_change_row.id,
        'status', room_change_row.status,
        'rejection_reason', room_change_row.rejection_reason,
        'processed_at', room_change_row.processed_at,
        'new_room_id', room_change_row.new_room_id
      )
      from public.room_change_requests as room_change_row
      where room_change_row.tenant_id = (
        select tenant_row.id
        from current_tenant as tenant_row
        limit 1
      )
      and room_change_row.status in ('approved', 'rejected')
      order by room_change_row.processed_at desc nulls last
      limit 1
    )
  )
  from request_identity as identity_row
  where identity_row.user_id is not null;
$$;

revoke all on function hostelset_private.get_my_tenant_dashboard_snapshot_impl()
  from public, anon;
grant execute on function hostelset_private.get_my_tenant_dashboard_snapshot_impl()
  to authenticated;

create or replace function public.get_my_tenant_dashboard_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select hostelset_private.get_my_tenant_dashboard_snapshot_impl();
$$;

revoke all on function public.get_my_tenant_dashboard_snapshot()
  from public, anon;
grant execute on function public.get_my_tenant_dashboard_snapshot()
  to authenticated;

comment on function hostelset_private.get_my_tenant_dashboard_snapshot_impl() is
  'Private tenant-scoped snapshot implementation that avoids repeated RLS policy evaluation.';

comment on function public.get_my_tenant_dashboard_snapshot() is
  'Returns snapshot version 1 for the authenticated tenant through a private fixed-scope helper.';