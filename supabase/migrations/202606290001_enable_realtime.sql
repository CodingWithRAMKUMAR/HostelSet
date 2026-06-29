-- Enables Postgres Changes for the tables used by HostelSet dashboards.
-- Apply with `supabase db push` after reviewing RLS policies for every table.
do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'users',
    'properties',
    'rooms',
    'tenants',
    'payment_history',
    'applications',
    'pre_bookings',
    'complaints',
    'check_out_requests',
    'room_change_requests',
    'notices',
    'owner_memberships',
    'owner_settings'
  ];
begin
  foreach table_name in array realtime_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- Avoid a recursive tenants-table RLS policy by resolving the signed-in
-- tenant's room through a small security-definer helper.
create or replace function public.current_tenant_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant.room_id
  from public.tenants as tenant
  where tenant.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_tenant_room_id() from public;
grant execute on function public.current_tenant_room_id() to authenticated;

drop policy if exists "tenants_can_view_roommates" on public.tenants;
create policy "tenants_can_view_roommates"
on public.tenants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or room_id = public.current_tenant_room_id()
);
