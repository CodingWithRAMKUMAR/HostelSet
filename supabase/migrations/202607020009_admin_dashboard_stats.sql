-- Complete the production admin overview counters without transferring full
-- datasets to the browser. Authorization remains enforced inside the RPC.

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
  owner_count bigint;
  active_owner_count bigint;
  active_membership_count bigint;
  revenue_total numeric;
  complaint_count bigint;
  vacate_count bigint;
begin
  if not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;

  select count(*) into property_count from public.properties;
  select count(*) into tenant_count
  from public.tenants
  where status in ('active', 'notice_period', 'payment_pending');
  select count(*) into owner_count from public.users where role = 'owner';
  select count(*) into active_owner_count
  from public.users where role = 'owner' and is_active;
  select count(*) into active_membership_count
  from public.properties
  where membership_active and membership_expiry > now();
  select coalesce(sum(amount), 0) into revenue_total
  from public.payment_history where status = 'success';
  select count(*) into complaint_count
  from public.complaints where status in ('open', 'in_progress');
  select count(*) into vacate_count
  from public.check_out_requests where status = 'pending';

  return jsonb_build_object(
    'totalProperties', property_count,
    'totalTenants', tenant_count,
    'totalOwners', owner_count,
    'activeOwners', active_owner_count,
    'activeMemberships', active_membership_count,
    'totalRevenue', revenue_total,
    'pendingComplaints', complaint_count,
    'pendingVacates', vacate_count
  );
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
