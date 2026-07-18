-- Reduce the admin landing-page request fan-out to one compact, read-only RPC.
-- Detailed management tables remain lazy-loaded when their tabs are opened.

create index if not exists applications_status_created_active_idx
  on public.applications(status, created_at desc)
  where deleted_at is null;

create index if not exists complaints_status_created_idx
  on public.complaints(status, created_at desc);

create index if not exists check_out_requests_status_created_idx
  on public.check_out_requests(status, created_at desc);

create index if not exists room_change_requests_status_requested_idx
  on public.room_change_requests(status, requested_at desc);

create index if not exists payment_history_status_date_idx
  on public.payment_history(status, payment_date desc);

create index if not exists notices_created_idx
  on public.notices(created_at desc);

create or replace function public.get_admin_dashboard_overview_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pending_membership_count bigint := 0;
  pending_application_count bigint := 0;
  open_complaint_count bigint := 0;
  pending_vacate_count bigint := 0;
  pending_room_change_count bigint := 0;
  payment_issue_count bigint := 0;
  notice_count bigint := 0;
  membership_rows jsonb := '[]'::jsonb;
  application_rows jsonb := '[]'::jsonb;
  complaint_rows jsonb := '[]'::jsonb;
  vacate_rows jsonb := '[]'::jsonb;
  room_change_rows jsonb := '[]'::jsonb;
  notice_rows jsonb := '[]'::jsonb;
begin
  if not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;

  select count(*) into pending_membership_count
  from public.membership_requests
  where status = 'pending';

  select count(*) into pending_application_count
  from public.applications
  where status = 'pending' and deleted_at is null;

  select count(*) into open_complaint_count
  from public.complaints
  where status in ('open', 'in_progress');

  select count(*) into pending_vacate_count
  from public.check_out_requests
  where status = 'pending';

  select count(*) into pending_room_change_count
  from public.room_change_requests
  where status = 'pending';

  select count(*) into payment_issue_count
  from public.payment_history
  where status = 'payment_pending';

  select count(*) into notice_count
  from public.notices;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.requested_at asc), '[]'::jsonb)
  into membership_rows
  from (
    select
      request.id,
      request.owner_id,
      request.property_id,
      request.plan_id,
      request.status,
      request.requested_at,
      jsonb_build_object(
        'id', owner_record.id,
        'full_name', owner_record.full_name
      ) as owner,
      jsonb_build_object(
        'id', property_record.id,
        'name', property_record.name
      ) as property
    from public.membership_requests request
    left join public.users owner_record on owner_record.id = request.owner_id
    left join public.properties property_record on property_record.id = request.property_id
    where request.status = 'pending'
    order by request.requested_at asc
    limit 2
  ) item;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc), '[]'::jsonb)
  into application_rows
  from (
    select
      application.id,
      application.name,
      application.status,
      application.created_at,
      jsonb_build_object(
        'id', room_record.id,
        'room_number', room_record.room_number
      ) as rooms
    from public.applications application
    left join public.rooms room_record on room_record.id = application.room_id
    where application.status = 'pending'
      and application.deleted_at is null
    order by application.created_at desc
    limit 2
  ) item;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc), '[]'::jsonb)
  into complaint_rows
  from (
    select
      complaint.id,
      complaint.title,
      complaint.status,
      complaint.created_at,
      jsonb_build_object(
        'id', tenant_record.id,
        'name', tenant_record.name
      ) as tenants
    from public.complaints complaint
    left join public.tenants tenant_record on tenant_record.id = complaint.tenant_id
    where complaint.status in ('open', 'in_progress')
    order by complaint.created_at desc
    limit 2
  ) item;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc), '[]'::jsonb)
  into vacate_rows
  from (
    select
      request.id,
      request.tenant_id,
      request.tenant_name,
      request.status,
      request.expected_check_out,
      request.created_at,
      jsonb_build_object(
        'id', tenant_record.id,
        'name', tenant_record.name
      ) as tenants
    from public.check_out_requests request
    left join public.tenants tenant_record on tenant_record.id = request.tenant_id
    where request.status = 'pending'
    order by request.created_at desc
    limit 1
  ) item;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.requested_at desc), '[]'::jsonb)
  into room_change_rows
  from (
    select
      request.id,
      request.tenant_id,
      request.status,
      request.requested_at,
      jsonb_build_object(
        'id', tenant_record.id,
        'name', tenant_record.name
      ) as tenants,
      jsonb_build_object(
        'id', old_room_record.id,
        'room_number', old_room_record.room_number
      ) as old_room,
      jsonb_build_object(
        'id', new_room_record.id,
        'room_number', new_room_record.room_number
      ) as new_room
    from public.room_change_requests request
    left join public.tenants tenant_record on tenant_record.id = request.tenant_id
    left join public.rooms old_room_record on old_room_record.id = request.old_room_id
    left join public.rooms new_room_record on new_room_record.id = request.new_room_id
    where request.status = 'pending'
    order by request.requested_at desc
    limit 1
  ) item;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc), '[]'::jsonb)
  into notice_rows
  from (
    select
      notice.id,
      notice.title,
      notice.type,
      notice.is_urgent,
      notice.created_at
    from public.notices notice
    order by notice.created_at desc
    limit 4
  ) item;

  return jsonb_build_object(
    'snapshot_version', 1,
    'counts', jsonb_build_object(
      'pending_memberships', pending_membership_count,
      'pending_applications', pending_application_count,
      'open_complaints', open_complaint_count,
      'pending_vacates', pending_vacate_count,
      'pending_room_changes', pending_room_change_count,
      'payment_issues', payment_issue_count,
      'notices', notice_count
    ),
    'membership_requests', membership_rows,
    'applications', application_rows,
    'complaints', complaint_rows,
    'vacate_requests', vacate_rows,
    'room_changes', room_change_rows,
    'notices', notice_rows
  );
end;
$$;

revoke all on function public.get_admin_dashboard_overview_snapshot() from public, anon;
grant execute on function public.get_admin_dashboard_overview_snapshot() to authenticated;
