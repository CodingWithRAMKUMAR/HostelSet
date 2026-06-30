-- Index the filters used by dashboard entry, realtime refreshes and active tabs.
create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists rooms_property_id_idx on public.rooms(property_id);
create index if not exists tenants_property_id_idx on public.tenants(property_id);
create index if not exists tenants_user_id_idx on public.tenants(user_id);
create index if not exists tenants_room_id_status_idx on public.tenants(room_id, status);
create index if not exists payment_history_tenant_status_date_idx on public.payment_history(tenant_id, status, payment_date desc);
create index if not exists complaints_property_status_created_idx on public.complaints(property_id, status, created_at desc);
create index if not exists check_out_requests_property_status_idx on public.check_out_requests(property_id, status);
create index if not exists check_out_requests_tenant_status_idx on public.check_out_requests(tenant_id, status);
create index if not exists room_change_requests_property_status_idx on public.room_change_requests(property_id, status, requested_at desc);
create index if not exists room_change_requests_tenant_status_idx on public.room_change_requests(tenant_id, status);
create index if not exists applications_property_status_idx on public.applications(property_id, status, created_at desc);
create index if not exists pre_bookings_property_status_idx on public.pre_bookings(property_id, status, created_at desc);
create index if not exists notices_property_created_idx on public.notices(property_id, created_at desc);

-- Return the admin landing-page counters in one small response instead of
-- transferring every successful payment to the browser for summation.
create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  property_count bigint;
  tenant_count bigint;
  revenue_total numeric;
  complaint_count bigint;
  vacate_count bigint;
begin
  if not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;

  select count(*) into property_count from public.properties;
  select count(*) into tenant_count from public.tenants;
  select coalesce(sum(amount), 0) into revenue_total from public.payment_history where status = 'success';
  select count(*) into complaint_count from public.complaints where status in ('open', 'in_progress');
  select count(*) into vacate_count from public.check_out_requests where status = 'pending';

  return jsonb_build_object(
    'totalProperties', property_count,
    'totalTenants', tenant_count,
    'totalRevenue', revenue_total,
    'pendingComplaints', complaint_count,
    'pendingVacates', vacate_count
  );
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
