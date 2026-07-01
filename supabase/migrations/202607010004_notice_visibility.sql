-- Global notices (property_id is null) are visible to every authenticated
-- owner and tenant; property notices stay scoped to their property.

alter table public.notices enable row level security;

drop policy if exists notices_visible on public.notices;
create policy notices_visible
on public.notices for select to authenticated
using (
  public.is_hostelset_admin()
  or property_id is null
  or exists (
    select 1 from public.properties property
    where property.id = notices.property_id
      and property.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.tenants tenant
    where tenant.property_id = notices.property_id
      and tenant.user_id = auth.uid()
  )
);

grant select on public.notices to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end $$;
