-- Repair tenant archive status consistency and make notification targets actionable.

alter table public.tenants
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists vacated_at timestamptz,
  add column if not exists vacate_reason text;

update public.tenants
set status = 'inactive',
    archived_at = coalesce(archived_at, updated_at, now())
where lower(status) in ('archived', 'vacated');

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'tenants'
      and constraint_name = 'tenants_status_check'
  ) then
    alter table public.tenants drop constraint tenants_status_check;
  end if;
end $$;

alter table public.tenants
  add constraint tenants_status_check
  check (status in ('active', 'notice_period', 'payment_pending', 'inactive'));

drop function if exists public.archive_tenant(uuid);

create or replace function public.archive_tenant(p_tenant_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  room_record public.rooms%rowtype;
  property_record public.properties%rowtype;
  actor_record public.users%rowtype;
  new_occupants integer;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
  released boolean := false;
begin
  select * into actor_record
  from public.users
  where id = auth.uid()
    and coalesce(is_active, true)
    and role in ('owner', 'admin');

  if actor_record.id is null then
    raise exception 'Active owner or admin access required';
  end if;

  select * into tenant_record
  from public.tenants
  where id = p_tenant_id
  for update;

  if tenant_record.id is null then raise exception 'Tenant not found'; end if;

  select * into property_record
  from public.properties
  where id = tenant_record.property_id;

  if property_record.id is null then raise exception 'Tenant property not found'; end if;
  if actor_record.role = 'owner' and property_record.owner_id is distinct from actor_record.id then
    raise exception 'Not authorized to archive this tenant';
  end if;
  if actor_record.role = 'admin' and not public.is_hostelset_admin() then
    raise exception 'Admin access required';
  end if;

  if tenant_record.status = 'inactive' then
    return jsonb_build_object(
      'success', true,
      'tenant_id', tenant_record.id,
      'final_status', 'inactive',
      'room_id', tenant_record.room_id,
      'occupancy_released', false,
      'already_archived', true
    );
  end if;

  if tenant_record.status not in ('active', 'notice_period', 'payment_pending') then
    raise exception 'Tenant is not in an archivable state';
  end if;

  select * into room_record
  from public.rooms
  where id = tenant_record.room_id
  for update;

  if room_record.id is null then raise exception 'Tenant room not found'; end if;
  new_occupants := greatest(0, coalesce(room_record.current_occupants, 0) - 1);
  released := coalesce(room_record.current_occupants, 0) > new_occupants;

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
    update public.users
    set is_active = false, updated_at = now()
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

  return jsonb_build_object(
    'success', true,
    'tenant_id', tenant_record.id,
    'final_status', 'inactive',
    'room_id', room_record.id,
    'occupancy_released', released,
    'already_archived', false
  );
end;
$$;

revoke all on function public.archive_tenant(uuid, text) from public, anon;
grant execute on function public.archive_tenant(uuid, text) to authenticated;

create or replace function public.notifications_after_application_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_label text;
  property_name text;
begin
  if new.status = 'pending' then
    select room_number into room_label from public.rooms where id = new.room_id;
    select name into property_name from public.properties where id = new.property_id;
    perform public.notify_property_owner(
      new.property_id, 'application_submitted',
      'Application: ' || coalesce(new.name, 'Applicant'),
      coalesce(new.name, 'An applicant') || ' applied for ' || coalesce(property_name, 'your property') || coalesce(' · Room ' || room_label, '') || '.',
      '/owner/dashboard?tab=applications&application_id=' || new.id::text,
      jsonb_build_object('application_id', new.id, 'property_id', new.property_id, 'room_id', new.room_id, 'tenant_name', new.name, 'room_number', room_label)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notifications_after_complaint_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(
    new.property_id, 'complaint_submitted',
    'Complaint: ' || coalesce(new.tenant_name, 'Tenant'),
    coalesce(new.tenant_name, 'A tenant') || coalesce(' in Room ' || new.room_number, '') || ' submitted: ' || coalesce(new.title, 'Complaint') || '.',
    '/owner/dashboard?tab=complaints&complaint_id=' || new.id::text,
    jsonb_build_object('complaint_id', new.id, 'tenant_id', new.tenant_id, 'room_id', new.room_id, 'tenant_name', new.tenant_name, 'room_number', new.room_number)
  );
  return new;
end;
$$;

create or replace function public.notifications_after_room_change_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tenant_name text;
  old_room text;
  new_room text;
begin
  select name into tenant_name from public.tenants where id = new.tenant_id;
  select room_number into old_room from public.rooms where id = new.old_room_id;
  select room_number into new_room from public.rooms where id = new.new_room_id;
  perform public.notify_property_owner(
    new.property_id, 'room_change_requested',
    'Room change: ' || coalesce(tenant_name, 'Tenant'),
    coalesce(tenant_name, 'A tenant') || ' requested a move from Room ' || coalesce(old_room, 'N/A') || ' to Room ' || coalesce(new_room, 'N/A') || '.',
    '/owner/dashboard?tab=room-change&request_id=' || new.id::text,
    jsonb_build_object('request_id', new.id, 'tenant_id', new.tenant_id, 'old_room_id', new.old_room_id, 'new_room_id', new.new_room_id, 'tenant_name', tenant_name, 'old_room_number', old_room, 'new_room_number', new_room)
  );
  return new;
end;
$$;

create or replace function public.notifications_after_checkout_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(
    new.property_id, 'vacate_requested',
    'Vacate: ' || coalesce(new.tenant_name, 'Tenant'),
    coalesce(new.tenant_name, 'A tenant') || ' requested vacate for Room ' || coalesce(new.room_number, 'N/A') || ' on ' || coalesce(new.expected_check_out::text, 'the selected date') || '.',
    '/owner/dashboard?tab=vacate&request_id=' || new.id::text,
    jsonb_build_object('request_id', new.id, 'tenant_id', new.tenant_id, 'room_id', new.room_id, 'tenant_name', new.tenant_name, 'room_number', new.room_number, 'expected_check_out', new.expected_check_out)
  );
  return new;
end;
$$;

create or replace function public.notifications_after_payment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tenant_record record;
begin
  if new.status = 'payment_pending' then
    select tenant.id, tenant.name, tenant.property_id, room.room_number
    into tenant_record
    from public.tenants tenant
    left join public.rooms room on room.id = tenant.room_id
    where tenant.id = new.tenant_id;
    perform public.notify_property_owner(
      tenant_record.property_id,
      'rent_payment_submitted',
      'Payment: ' || coalesce(tenant_record.name, 'Tenant'),
      coalesce(tenant_record.name, 'A tenant') || coalesce(' · Room ' || tenant_record.room_number, '') || ' submitted ' || coalesce(new.payment_method, 'payment') || ' for verification.',
      '/owner/dashboard?tab=rent-payments&payment_id=' || new.id::text,
      jsonb_build_object('payment_id', new.id, 'tenant_id', new.tenant_id, 'tenant_name', tenant_record.name, 'room_number', tenant_record.room_number, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notifications_after_application_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') and new.user_id is not null then
    perform public.create_notification_record(
      new.user_id, 'tenant', new.property_id, 'application_' || new.status,
      'Application ' || new.status,
      'Your application for ' || coalesce(new.name, 'HostelSet') || ' was ' || new.status || '.',
      case when new.status = 'approved' then '/tenant/dashboard?tab=overview&application_id=' || new.id::text else '/login' end,
      jsonb_build_object('application_id', new.id, 'property_id', new.property_id, 'room_id', new.room_id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notifications_after_room_change_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    select user_id into tenant_user from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(
      tenant_user, 'tenant', new.property_id, 'room_change_' || new.status,
      'Room change ' || new.status,
      'Your room change request was ' || new.status || '.',
      '/tenant/dashboard?tab=room-change&request_id=' || new.id::text,
      jsonb_build_object('request_id', new.id, 'tenant_id', new.tenant_id, 'old_room_id', new.old_room_id, 'new_room_id', new.new_room_id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notifications_after_checkout_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    select user_id into tenant_user from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(
      tenant_user, 'tenant', new.property_id, 'vacate_' || new.status,
      'Vacate request ' || new.status,
      'Your vacate request for Room ' || coalesce(new.room_number, 'N/A') || ' was ' || new.status || '.',
      '/tenant/dashboard?tab=vacate&request_id=' || new.id::text,
      jsonb_build_object('request_id', new.id, 'tenant_id', new.tenant_id, 'room_id', new.room_id, 'room_number', new.room_number, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function public.notifications_after_payment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid; tenant_property uuid; tenant_name text; room_label text;
begin
  if new.status is distinct from old.status and new.status = 'success' then
    select tenant.user_id, tenant.property_id, tenant.name, room.room_number
    into tenant_user, tenant_property, tenant_name, room_label
    from public.tenants tenant
    left join public.rooms room on room.id = tenant.room_id
    where tenant.id = new.tenant_id;
    perform public.create_notification_record(
      tenant_user, 'tenant', tenant_property, 'rent_payment_approved',
      'Payment approved',
      'Your payment for Room ' || coalesce(room_label, 'N/A') || ' was approved.',
      '/tenant/dashboard?tab=payments&payment_id=' || new.id::text,
      jsonb_build_object('payment_id', new.id, 'tenant_id', new.tenant_id, 'tenant_name', tenant_name, 'room_number', room_label, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$;
