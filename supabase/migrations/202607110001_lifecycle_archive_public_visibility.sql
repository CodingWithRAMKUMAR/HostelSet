-- Archive-based lifecycle management and safe public property discovery.
-- Normal product flows archive properties/tenants instead of hard-deleting them.

alter table public.properties
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'suspended', 'archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references public.users(id) on delete set null;

alter table public.tenants
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists vacated_at timestamptz,
  add column if not exists vacate_reason text;

create index if not exists properties_public_lifecycle_idx
  on public.properties(lifecycle_status, is_active, archived_at);

create index if not exists tenants_property_active_status_idx
  on public.tenants(property_id, status)
  where status in ('active', 'notice_period', 'payment_pending');

create table if not exists public.lifecycle_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  property_id uuid references public.properties(id) on delete set null,
  reason text,
  before_status jsonb,
  after_status jsonb,
  outcome text not null default 'success',
  created_at timestamptz not null default now()
);

create index if not exists lifecycle_audit_target_idx
  on public.lifecycle_audit_logs(target_type, target_id, created_at desc);
create index if not exists lifecycle_audit_property_idx
  on public.lifecycle_audit_logs(property_id, created_at desc);

alter table public.lifecycle_audit_logs enable row level security;

revoke all on public.lifecycle_audit_logs from public, anon;
grant select on public.lifecycle_audit_logs to authenticated;

drop policy if exists lifecycle_audit_admin_read on public.lifecycle_audit_logs;
create policy lifecycle_audit_admin_read
on public.lifecycle_audit_logs for select to authenticated
using (public.is_hostelset_admin());

drop policy if exists lifecycle_audit_owner_read on public.lifecycle_audit_logs;
create policy lifecycle_audit_owner_read
on public.lifecycle_audit_logs for select to authenticated
using (
  property_id is not null
  and exists (
    select 1 from public.properties property
    where property.id = lifecycle_audit_logs.property_id
      and property.owner_id = auth.uid()
  )
);

create or replace function public.is_public_property_visible(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.is_active = true
      and coalesce(property.lifecycle_status, 'active') = 'active'
      and property.archived_at is null
      and exists (
        select 1
        from public.tenants tenant
        where tenant.property_id = property.id
          and tenant.status in ('active', 'notice_period', 'payment_pending')
      )
  );
$$;

revoke all on function public.is_public_property_visible(uuid) from public, anon, authenticated;
grant execute on function public.is_public_property_visible(uuid) to anon, authenticated;

drop policy if exists properties_public_read on public.properties;
create policy properties_public_read
on public.properties for select to anon, authenticated
using (
  is_active
  and coalesce(lifecycle_status, 'active') = 'active'
  and archived_at is null
);

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read
on public.rooms for select to anon, authenticated
using (public.is_public_property_visible(property_id));

drop policy if exists settings_public_read on public.owner_settings;
create policy settings_public_read
on public.owner_settings for select to anon, authenticated
using (property_id is not null and public.is_public_property_visible(property_id));

create or replace function public.get_public_properties()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  city text,
  address text,
  formatted_address text,
  pincode text,
  property_type text,
  amenities text[],
  photos text[],
  contact_number text,
  latitude double precision,
  longitude double precision,
  location_verified boolean,
  active_tenant_count integer,
  total_rooms integer,
  total_capacity integer,
  current_occupants integer,
  lowest_rent numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with room_stats as (
    select
      room.property_id,
      count(*)::integer as total_rooms,
      coalesce(sum(room.capacity), 0)::integer as total_capacity,
      coalesce(sum(room.current_occupants), 0)::integer as current_occupants,
      min(room.monthly_rent) as lowest_rent
    from public.rooms room
    group by room.property_id
  ),
  tenant_stats as (
    select tenant.property_id, count(*)::integer as active_tenant_count
    from public.tenants tenant
    where tenant.status in ('active', 'notice_period', 'payment_pending')
    group by tenant.property_id
  )
  select
    property.id,
    property.slug,
    property.name,
    property.description,
    property.city,
    property.address,
    property.formatted_address,
    property.pincode,
    property.property_type,
    property.amenities,
    property.photos,
    property.contact_number,
    property.latitude,
    property.longitude,
    property.location_verified,
    tenant_stats.active_tenant_count,
    coalesce(room_stats.total_rooms, 0),
    coalesce(room_stats.total_capacity, 0),
    coalesce(room_stats.current_occupants, 0),
    room_stats.lowest_rent,
    property.created_at,
    property.updated_at
  from public.properties property
  join tenant_stats on tenant_stats.property_id = property.id
  left join room_stats on room_stats.property_id = property.id
  where property.is_active = true
    and coalesce(property.lifecycle_status, 'active') = 'active'
    and property.archived_at is null
  order by property.created_at desc;
$$;

revoke all on function public.get_public_properties() from public, anon, authenticated;
grant execute on function public.get_public_properties() to anon, authenticated;

create or replace function public.get_public_property_by_identifier(p_identifier text)
returns setof public.properties
language sql
stable
security definer
set search_path = ''
as $$
  select property.*
  from public.properties property
  where (property.id::text = p_identifier or property.slug = p_identifier)
    and public.is_public_property_visible(property.id)
  limit 1;
$$;

revoke all on function public.get_public_property_by_identifier(text) from public, anon, authenticated;
grant execute on function public.get_public_property_by_identifier(text) to anon, authenticated;

create or replace function public.archive_property(p_property_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_record public.properties%rowtype;
  actor_record public.users%rowtype;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into actor_record from public.users where id = auth.uid() and coalesce(is_active, true);
  if actor_record.id is null then raise exception 'Authentication required'; end if;

  select * into property_record from public.properties where id = p_property_id for update;
  if property_record.id is null then raise exception 'Property not found'; end if;

  if actor_record.role <> 'admin' and property_record.owner_id is distinct from actor_record.id then
    raise exception 'Not authorized to archive this property';
  end if;

  if coalesce(property_record.lifecycle_status, 'active') = 'archived' or property_record.archived_at is not null then
    return jsonb_build_object('success', true, 'duplicate', true, 'status', 'archived');
  end if;

  update public.properties
  set lifecycle_status = 'archived',
      is_active = false,
      archived_at = now(),
      archived_by = actor_record.id,
      archive_reason = clean_reason,
      updated_at = now()
  where id = property_record.id;

  insert into public.lifecycle_audit_logs (
    actor_user_id, actor_role, action, target_type, target_id, property_id, reason, before_status, after_status, outcome
  ) values (
    actor_record.id, actor_record.role, 'archive_property', 'property', property_record.id, property_record.id, clean_reason,
    jsonb_build_object('is_active', property_record.is_active, 'lifecycle_status', property_record.lifecycle_status, 'archived_at', property_record.archived_at),
    jsonb_build_object('is_active', false, 'lifecycle_status', 'archived', 'archived_at', now()),
    'success'
  );

  return jsonb_build_object('success', true, 'duplicate', false, 'status', 'archived');
end;
$$;

revoke all on function public.archive_property(uuid, text) from public, anon;
grant execute on function public.archive_property(uuid, text) to authenticated;

create or replace function public.restore_property(p_property_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_record public.properties%rowtype;
  actor_record public.users%rowtype;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into actor_record from public.users where id = auth.uid() and coalesce(is_active, true);
  if actor_record.id is null then raise exception 'Authentication required'; end if;

  select * into property_record from public.properties where id = p_property_id for update;
  if property_record.id is null then raise exception 'Property not found'; end if;

  if actor_record.role <> 'admin' and property_record.owner_id is distinct from actor_record.id then
    raise exception 'Not authorized to restore this property';
  end if;

  if coalesce(property_record.lifecycle_status, 'active') <> 'archived' and property_record.archived_at is null then
    return jsonb_build_object('success', true, 'duplicate', true, 'status', coalesce(property_record.lifecycle_status, 'active'));
  end if;

  update public.properties
  set lifecycle_status = 'active',
      is_active = true,
      archived_at = null,
      archived_by = null,
      archive_reason = null,
      restored_at = now(),
      restored_by = actor_record.id,
      updated_at = now()
  where id = property_record.id;

  insert into public.lifecycle_audit_logs (
    actor_user_id, actor_role, action, target_type, target_id, property_id, reason, before_status, after_status, outcome
  ) values (
    actor_record.id, actor_record.role, 'restore_property', 'property', property_record.id, property_record.id, clean_reason,
    jsonb_build_object('is_active', property_record.is_active, 'lifecycle_status', property_record.lifecycle_status, 'archived_at', property_record.archived_at),
    jsonb_build_object('is_active', true, 'lifecycle_status', 'active', 'archived_at', null),
    'success'
  );

  return jsonb_build_object('success', true, 'duplicate', false, 'status', 'active', 'publicly_visible', public.is_public_property_visible(property_record.id));
end;
$$;

revoke all on function public.restore_property(uuid, text) from public, anon;
grant execute on function public.restore_property(uuid, text) to authenticated;

drop function if exists public.archive_tenant(uuid);
create function public.archive_tenant(p_tenant_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  actor_record public.users%rowtype;
  new_occupants integer;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into actor_record from public.users where id = auth.uid() and coalesce(is_active, true);
  if actor_record.id is null then raise exception 'Authentication required'; end if;

  select * into tenant_record from public.tenants where id = p_tenant_id for update;
  if tenant_record.id is null then raise exception 'Tenant not found'; end if;

  select owner_id into property_owner from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from actor_record.id and not public.is_hostelset_admin() then
    raise exception 'Not authorized to archive this tenant';
  end if;

  if tenant_record.status = 'inactive' then
    return jsonb_build_object('success', true, 'duplicate', true);
  end if;

  select * into room_record from public.rooms where id = tenant_record.room_id for update;
  if room_record.id is null then raise exception 'Tenant room not found'; end if;
  new_occupants := greatest(0, coalesce(room_record.current_occupants, 0) - 1);

  update public.tenants
  set status = 'inactive',
      check_out_requested = false,
      notice_period_start = null,
      notice_period_end = null,
      archived_at = coalesce(archived_at, now()),
      archived_by = actor_record.id,
      archive_reason = clean_reason,
      vacated_at = coalesce(vacated_at, now()),
      vacate_reason = clean_reason,
      updated_at = now()
  where id = tenant_record.id;

  update public.rooms
  set current_occupants = new_occupants,
      status = case when new_occupants >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  update public.room_change_requests
  set status = 'rejected',
      rejection_reason = coalesce(rejection_reason, 'Tenant archived'),
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where tenant_id = tenant_record.id and status = 'pending';

  update public.check_out_requests
  set status = 'cancelled',
      processed_at = coalesce(processed_at, now()),
      updated_at = now()
  where tenant_id = tenant_record.id and status = 'pending';

  update public.rent_records
  set status = 'cancelled', updated_at = now()
  where tenant_id = tenant_record.id and status = 'unpaid';

  if tenant_record.user_id is not null and not exists (
    select 1 from public.tenants
    where user_id = tenant_record.user_id
      and id <> tenant_record.id
      and status in ('active','notice_period','payment_pending')
  ) then
    update public.users set is_active = false, updated_at = now()
    where id = tenant_record.user_id and role = 'tenant';
  end if;

  insert into public.lifecycle_audit_logs (
    actor_user_id, actor_role, action, target_type, target_id, property_id, reason, before_status, after_status, outcome
  ) values (
    actor_record.id, actor_record.role, 'archive_tenant', 'tenant', tenant_record.id, tenant_record.property_id, clean_reason,
    jsonb_build_object('status', tenant_record.status, 'room_id', tenant_record.room_id, 'room_occupants', room_record.current_occupants),
    jsonb_build_object('status', 'inactive', 'room_id', tenant_record.room_id, 'room_occupants', new_occupants),
    'success'
  );

  return jsonb_build_object('success', true, 'duplicate', false, 'room_id', room_record.id);
end;
$$;

revoke all on function public.archive_tenant(uuid, text) from public, anon;
grant execute on function public.archive_tenant(uuid, text) to authenticated;
