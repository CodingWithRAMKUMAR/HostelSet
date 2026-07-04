-- Isolated onboarding workflow for people who already occupy a property.

create extension if not exists pgcrypto;

create table if not exists public.existing_tenant_import_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  token text not null unique check (length(token) >= 48),
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.existing_tenant_imports (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.existing_tenant_import_links(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text not null,
  room_number text not null,
  current_rent numeric(12,2) not null check (current_rent > 0),
  move_in_date date not null,
  emergency_contact text not null,
  occupation text not null check (occupation in ('student','employee','other')),
  id_proof text not null,
  profile_photo text not null,
  notes text,
  status text not null default 'pending_owner_review'
    check (status in ('pending_owner_review','approved','rejected')),
  rejection_reason text,
  processed_at timestamptz,
  processed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists existing_tenant_import_links_owner_idx
  on public.existing_tenant_import_links(owner_id, property_id);
create index if not exists existing_tenant_imports_property_idx
  on public.existing_tenant_imports(property_id);
create index if not exists existing_tenant_imports_status_idx
  on public.existing_tenant_imports(status);
create index if not exists existing_tenant_imports_property_status_created_idx
  on public.existing_tenant_imports(property_id, status, created_at desc);
create index if not exists existing_tenant_imports_created_idx
  on public.existing_tenant_imports(created_at desc);
create index if not exists existing_tenant_imports_user_idx
  on public.existing_tenant_imports(user_id);
create index if not exists existing_tenant_imports_room_idx
  on public.existing_tenant_imports(room_id);
create unique index if not exists existing_tenant_imports_active_phone_uidx
  on public.existing_tenant_imports(property_id, phone)
  where status in ('pending_owner_review','approved');
create unique index if not exists existing_tenant_imports_active_email_uidx
  on public.existing_tenant_imports(property_id, lower(email))
  where status in ('pending_owner_review','approved');

alter table public.existing_tenant_import_links enable row level security;
alter table public.existing_tenant_imports enable row level security;

drop policy if exists existing_tenant_import_links_owner_admin_read on public.existing_tenant_import_links;
create policy existing_tenant_import_links_owner_admin_read
on public.existing_tenant_import_links for select to authenticated
using (
  public.is_hostelset_admin()
    or exists (select 1 from public.properties property where property.id = existing_tenant_import_links.property_id and property.owner_id = auth.uid())
);

drop policy if exists existing_tenant_imports_owner_admin_read on public.existing_tenant_imports;
create policy existing_tenant_imports_owner_admin_read
on public.existing_tenant_imports for select to authenticated
using (
  public.is_hostelset_admin()
    or exists (select 1 from public.properties property where property.id = existing_tenant_imports.property_id and property.owner_id = auth.uid())
);

drop trigger if exists set_updated_at on public.existing_tenant_import_links;
create trigger set_updated_at before update on public.existing_tenant_import_links
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.existing_tenant_imports;
create trigger set_updated_at before update on public.existing_tenant_imports
for each row execute function public.set_updated_at();

create or replace function public.rotate_existing_tenant_import_link(p_property_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_owner uuid;
  next_token text;
begin
  select owner_id into property_owner from public.properties where id = p_property_id;
  if property_owner is null then raise exception 'Property not found'; end if;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;

  next_token := encode(gen_random_bytes(32), 'hex');
  insert into public.existing_tenant_import_links(property_id, owner_id, token, is_active, generated_at)
  values (p_property_id, property_owner, next_token, true, now())
  on conflict(property_id) do update
    set owner_id = excluded.owner_id, token = excluded.token, is_active = true, generated_at = now(), updated_at = now();
  return next_token;
end;
$$;

create or replace function public.set_existing_tenant_import_link_enabled(
  p_property_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_owner uuid;
begin
  select owner_id into property_owner from public.properties where id = p_property_id;
  if property_owner is null then raise exception 'Property not found'; end if;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;

  update public.existing_tenant_import_links
  set is_active = p_enabled, updated_at = now()
  where property_id = p_property_id;
  if not found then raise exception 'Generate an import link first'; end if;
  return p_enabled;
end;
$$;

create or replace function public.approve_existing_tenant_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  new_tenant_id uuid;
begin
  select * into import_record
  from public.existing_tenant_imports
  where id = p_import_id
  for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;

  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status = 'approved' then
    return jsonb_build_object('success', true, 'tenant_id', import_record.tenant_id, 'status', 'approved');
  end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Import submission has already been processed'; end if;

  select * into room_record
  from public.rooms
  where id = import_record.room_id and property_id = import_record.property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'Selected room is full'; end if;

  if exists (
    select 1 from public.tenants tenant
    where tenant.property_id = import_record.property_id
      and (
        tenant.user_id = import_record.user_id
        or tenant.phone = import_record.phone
        or lower(tenant.email) = lower(import_record.email)
      )
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Tenant already exists for this property'; end if;

  insert into public.tenants(
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status
  ) values (
    import_record.user_id, import_record.property_id, import_record.room_id,
    import_record.full_name, import_record.phone, import_record.email,
    import_record.current_rent, 0, 0, 'paid', import_record.move_in_date, 'active'
  ) returning id into new_tenant_id;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.existing_tenant_imports
  set status = 'approved', tenant_id = new_tenant_id, rejection_reason = null,
      processed_at = now(), processed_by = auth.uid(), updated_at = now()
  where id = import_record.id;

  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

create or replace function public.reject_existing_tenant_import(
  p_import_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  property_owner uuid;
begin
  select * into import_record from public.existing_tenant_imports where id = p_import_id for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;
  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status = 'rejected' then return jsonb_build_object('success', true, 'status', 'rejected'); end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Import submission has already been processed'; end if;
  if length(coalesce(p_reason, '')) > 1000 then raise exception 'Rejection reason is too long'; end if;

  update public.existing_tenant_imports
  set status = 'rejected', rejection_reason = nullif(trim(p_reason), ''),
      processed_at = now(), processed_by = auth.uid(), updated_at = now()
  where id = import_record.id;
  return jsonb_build_object('success', true, 'status', 'rejected');
end;
$$;

revoke all on table public.existing_tenant_import_links from anon, authenticated;
revoke all on table public.existing_tenant_imports from anon, authenticated;
grant select on table public.existing_tenant_import_links to authenticated;
grant select on table public.existing_tenant_imports to authenticated;
grant all on table public.existing_tenant_import_links to service_role;
grant all on table public.existing_tenant_imports to service_role;

revoke all on function public.rotate_existing_tenant_import_link(uuid) from public, anon;
revoke all on function public.set_existing_tenant_import_link_enabled(uuid, boolean) from public, anon;
revoke all on function public.approve_existing_tenant_import(uuid) from public, anon;
revoke all on function public.reject_existing_tenant_import(uuid, text) from public, anon;
grant execute on function public.rotate_existing_tenant_import_link(uuid) to authenticated;
grant execute on function public.set_existing_tenant_import_link_enabled(uuid, boolean) to authenticated;
grant execute on function public.approve_existing_tenant_import(uuid) to authenticated;
grant execute on function public.reject_existing_tenant_import(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'existing_tenant_imports'
  ) then
    alter publication supabase_realtime add table public.existing_tenant_imports;
  end if;
end $$;
