-- Preserve tenant financial history while allowing admin-side account removal
-- and clean re-application after a tenant is permanently removed.

alter table public.payment_history
  add column if not exists snapshot_name text,
  add column if not exists snapshot_phone text,
  add column if not exists snapshot_email text,
  add column if not exists tenant_deleted_at timestamptz;

alter table public.rent_records
  add column if not exists snapshot_name text,
  add column if not exists snapshot_phone text,
  add column if not exists snapshot_email text,
  add column if not exists tenant_deleted_at timestamptz;

alter table public.applications
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists source_status text;

alter table public.pre_bookings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists source_status text;

alter table public.existing_tenant_imports
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists source_status text;

alter table public.tenants
  alter column user_id drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'tenants'
      and constraint_name = 'tenants_user_id_fkey'
  ) then
    alter table public.tenants drop constraint tenants_user_id_fkey;
  end if;
end $$;

alter table public.tenants
  add constraint tenants_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'existing_tenant_imports'
      and constraint_name = 'existing_tenant_imports_user_id_fkey'
  ) then
    alter table public.existing_tenant_imports drop constraint existing_tenant_imports_user_id_fkey;
  end if;
end $$;

alter table public.existing_tenant_imports
  alter column user_id drop not null,
  add constraint existing_tenant_imports_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

drop index if exists public.applications_one_active_phone_per_property;
drop index if exists public.applications_one_active_email_per_property;
drop index if exists public.prebookings_one_active_phone_per_property;
drop index if exists public.prebookings_one_active_email_per_property;
drop index if exists public.existing_tenant_imports_active_phone_uidx;
drop index if exists public.existing_tenant_imports_active_email_uidx;

create unique index applications_one_active_phone_per_property
  on public.applications(property_id, phone)
  where deleted_at is null and status in ('pending', 'approved');
create unique index applications_one_active_email_per_property
  on public.applications(property_id, lower(email))
  where deleted_at is null and status in ('pending', 'approved');
create unique index prebookings_one_active_phone_per_property
  on public.pre_bookings(property_id, phone)
  where deleted_at is null and status in ('pending', 'approved');
create unique index prebookings_one_active_email_per_property
  on public.pre_bookings(property_id, lower(email))
  where deleted_at is null and status in ('pending', 'approved');
create unique index existing_tenant_imports_active_phone_uidx
  on public.existing_tenant_imports(property_id, phone)
  where deleted_at is null and status in ('pending_owner_review','approved');
create unique index existing_tenant_imports_active_email_uidx
  on public.existing_tenant_imports(property_id, lower(email))
  where deleted_at is null and status in ('pending_owner_review','approved');

create or replace function public.archive_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  new_occupants integer;
begin
  select * into tenant_record from public.tenants where id = p_tenant_id for update;
  if tenant_record.id is null then raise exception 'Tenant not found'; end if;

  select owner_id into property_owner from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
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

  return jsonb_build_object('success', true, 'duplicate', false, 'room_id', room_record.id);
end;
$$;

revoke all on function public.archive_tenant(uuid) from public,anon;
grant execute on function public.archive_tenant(uuid) to authenticated;
