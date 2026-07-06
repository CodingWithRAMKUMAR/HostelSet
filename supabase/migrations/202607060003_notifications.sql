-- In-app notifications for HostelSet. Browser/PWA delivery is layered on top
-- of this table; native/Web Push can subscribe to the same records later.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('admin','owner','tenant')),
  property_id uuid references public.properties(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  action_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  metadata jsonb
);

create index if not exists notifications_recipient_read_created_idx
  on public.notifications(recipient_user_id, is_read, created_at desc);
create index if not exists notifications_property_created_idx
  on public.notifications(property_id, created_at desc);
create index if not exists notifications_type_created_idx
  on public.notifications(type, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

drop policy if exists notifications_admin_read_admin on public.notifications;
create policy notifications_admin_read_admin on public.notifications
for select to authenticated
using (recipient_role = 'admin' and public.is_hostelset_admin());

revoke all on table public.notifications from anon, authenticated;
grant select, update(is_read, read_at) on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create or replace function public.create_notification_record(
  p_recipient_user_id uuid,
  p_recipient_role text,
  p_property_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_action_url text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  if p_recipient_user_id is null then return null; end if;

  insert into public.notifications(
    recipient_user_id, recipient_role, property_id, type, title, message, action_url, metadata
  ) values (
    p_recipient_user_id, p_recipient_role, p_property_id, p_type, p_title, p_message, p_action_url, p_metadata
  )
  returning id into notification_id;

  return notification_id;
end;
$$;

revoke all on function public.create_notification_record(uuid,text,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_notification_record(uuid,text,uuid,text,text,text,text,jsonb) to service_role;

create or replace function public.notify_property_owner(
  p_property_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_action_url text default '/owner/dashboard',
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_owner_id uuid;
begin
  select owner_id into property_owner_id from public.properties where id = p_property_id;
  if property_owner_id is null then return; end if;
  perform public.create_notification_record(property_owner_id, 'owner', p_property_id, p_type, p_title, p_message, p_action_url, p_metadata);
end;
$$;

revoke all on function public.notify_property_owner(uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.notify_property_owner(uuid,text,text,text,text,jsonb) to service_role;

create or replace function public.notifications_after_application_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public.notify_property_owner(
      new.property_id, 'application_submitted', 'New application submitted',
      coalesce(new.name, 'An applicant') || ' submitted an application.',
      '/owner/dashboard?tab=applications',
      jsonb_build_object('application_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_application_insert on public.applications;
create trigger notifications_application_insert
after insert on public.applications
for each row execute function public.notifications_after_application_insert();

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
      'Your application was ' || new.status || '.',
      case when new.status = 'approved' then '/tenant/dashboard' else '/login' end,
      jsonb_build_object('application_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_application_update on public.applications;
create trigger notifications_application_update
after update on public.applications
for each row execute function public.notifications_after_application_update();

create or replace function public.notifications_after_import_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(
    new.property_id, 'existing_import_submitted', 'Existing tenant import submitted',
    coalesce(new.full_name, 'A tenant') || ' submitted import details.',
    '/owner/dashboard?tab=existing-imports',
    jsonb_build_object('import_id', new.id)
  );
  return new;
end;
$$;
drop trigger if exists notifications_import_insert on public.existing_tenant_imports;
create trigger notifications_import_insert after insert on public.existing_tenant_imports
for each row execute function public.notifications_after_import_insert();

create or replace function public.notifications_after_import_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status = 'approved' and new.user_id is not null then
    perform public.create_notification_record(
      new.user_id, 'tenant', new.property_id, 'existing_import_approved',
      'Import approved', 'Your existing tenant account was approved.',
      '/tenant/dashboard', jsonb_build_object('import_id', new.id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_import_update on public.existing_tenant_imports;
create trigger notifications_import_update after update on public.existing_tenant_imports
for each row execute function public.notifications_after_import_update();

create or replace function public.notifications_after_complaint_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(
    new.property_id, 'complaint_submitted', 'New complaint submitted',
    coalesce(new.tenant_name, 'A tenant') || ' submitted a complaint: ' || new.title,
    '/owner/dashboard?tab=complaints',
    jsonb_build_object('complaint_id', new.id)
  );
  return new;
end;
$$;
drop trigger if exists notifications_complaint_insert on public.complaints;
create trigger notifications_complaint_insert after insert on public.complaints
for each row execute function public.notifications_after_complaint_insert();

create or replace function public.notifications_after_complaint_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid;
begin
  if new.status is distinct from old.status or new.admin_response is distinct from old.admin_response then
    select user_id into tenant_user from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(
      tenant_user, 'tenant', new.property_id, 'complaint_updated', 'Complaint updated',
      'Your complaint "' || new.title || '" is now ' || new.status || '.',
      '/tenant/dashboard?tab=complaints',
      jsonb_build_object('complaint_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_complaint_update on public.complaints;
create trigger notifications_complaint_update after update on public.complaints
for each row execute function public.notifications_after_complaint_update();

create or replace function public.notifications_after_room_change_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(new.property_id, 'room_change_requested', 'Room change requested', 'A tenant requested a room change.', '/owner/dashboard?tab=room-change', jsonb_build_object('request_id', new.id));
  return new;
end;
$$;
drop trigger if exists notifications_room_change_insert on public.room_change_requests;
create trigger notifications_room_change_insert after insert on public.room_change_requests
for each row execute function public.notifications_after_room_change_insert();

create or replace function public.notifications_after_room_change_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    select user_id into tenant_user from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(tenant_user, 'tenant', new.property_id, 'room_change_' || new.status, 'Room change ' || new.status, 'Your room change request was ' || new.status || '.', '/tenant/dashboard', jsonb_build_object('request_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_room_change_update on public.room_change_requests;
create trigger notifications_room_change_update after update on public.room_change_requests
for each row execute function public.notifications_after_room_change_update();

create or replace function public.notifications_after_checkout_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_property_owner(new.property_id, 'vacate_requested', 'Vacate requested', coalesce(new.tenant_name, 'A tenant') || ' requested vacate.', '/owner/dashboard?tab=vacate', jsonb_build_object('request_id', new.id));
  return new;
end;
$$;
drop trigger if exists notifications_checkout_insert on public.check_out_requests;
create trigger notifications_checkout_insert after insert on public.check_out_requests
for each row execute function public.notifications_after_checkout_insert();

create or replace function public.notifications_after_checkout_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    select user_id into tenant_user from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(tenant_user, 'tenant', new.property_id, 'vacate_' || new.status, 'Vacate request ' || new.status, 'Your vacate request was ' || new.status || '.', '/tenant/dashboard', jsonb_build_object('request_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_checkout_update on public.check_out_requests;
create trigger notifications_checkout_update after update on public.check_out_requests
for each row execute function public.notifications_after_checkout_update();

create or replace function public.notifications_after_payment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_property uuid;
begin
  if new.status = 'payment_pending' then
    select property_id into tenant_property from public.tenants where id = new.tenant_id;
    perform public.notify_property_owner(tenant_property, 'rent_payment_submitted', 'Payment submitted', 'A tenant submitted a payment for verification.', '/owner/dashboard?tab=rent-payments', jsonb_build_object('payment_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_payment_insert on public.payment_history;
create trigger notifications_payment_insert after insert on public.payment_history
for each row execute function public.notifications_after_payment_insert();

create or replace function public.notifications_after_payment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid; tenant_property uuid;
begin
  if new.status is distinct from old.status and new.status = 'success' then
    select user_id, property_id into tenant_user, tenant_property from public.tenants where id = new.tenant_id;
    perform public.create_notification_record(tenant_user, 'tenant', tenant_property, 'rent_payment_approved', 'Payment approved', 'Your payment was approved.', '/tenant/dashboard?tab=payments', jsonb_build_object('payment_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_payment_update on public.payment_history;
create trigger notifications_payment_update after update on public.payment_history
for each row execute function public.notifications_after_payment_update();

create or replace function public.notifications_before_payment_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_user uuid; tenant_property uuid;
begin
  if old.status = 'payment_pending' then
    select user_id, property_id into tenant_user, tenant_property from public.tenants where id = old.tenant_id;
    perform public.create_notification_record(tenant_user, 'tenant', tenant_property, 'rent_payment_rejected', 'Payment rejected', 'Your submitted payment was rejected.', '/tenant/dashboard?tab=payments', jsonb_build_object('payment_id', old.id));
  end if;
  return old;
end;
$$;
drop trigger if exists notifications_payment_delete on public.payment_history;
create trigger notifications_payment_delete before delete on public.payment_history
for each row execute function public.notifications_before_payment_delete();

create or replace function public.notifications_after_notice_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_record record;
begin
  if new.property_id is not null then
    for tenant_record in select user_id from public.tenants where property_id = new.property_id and user_id is not null and status in ('active','notice_period','payment_pending') loop
      perform public.create_notification_record(tenant_record.user_id, 'tenant', new.property_id, 'notice_published', 'New notice: ' || new.title, new.content, '/tenant/dashboard?tab=notices', jsonb_build_object('notice_id', new.id));
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_notice_insert on public.notices;
create trigger notifications_notice_insert after insert on public.notices
for each row execute function public.notifications_after_notice_insert();

create or replace function public.notify_admins(
  p_type text,
  p_title text,
  p_message text,
  p_action_url text default '/admin/dashboard',
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare admin_record record;
begin
  for admin_record in select id from public.users where role = 'admin' and is_active = true loop
    perform public.create_notification_record(admin_record.id, 'admin', null, p_type, p_title, p_message, p_action_url, p_metadata);
  end loop;
end;
$$;

revoke all on function public.notify_admins(text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.notify_admins(text,text,text,text,jsonb) to service_role;

create or replace function public.notifications_after_property_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins(
    'property_added', 'New property added',
    coalesce(new.name, 'A property') || ' was added.',
    '/admin/dashboard?tab=properties',
    jsonb_build_object('property_id', new.id, 'owner_id', new.owner_id)
  );
  return new;
end;
$$;
drop trigger if exists notifications_property_insert on public.properties;
create trigger notifications_property_insert after insert on public.properties
for each row execute function public.notifications_after_property_insert();

create or replace function public.notifications_after_membership_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins(
    'membership_request', 'Membership request received',
    'An owner submitted a membership request.',
    '/admin/dashboard?tab=membership',
    jsonb_build_object('request_id', new.id, 'owner_id', new.owner_id, 'property_id', new.property_id)
  );
  return new;
end;
$$;
drop trigger if exists notifications_membership_insert on public.membership_requests;
create trigger notifications_membership_insert after insert on public.membership_requests
for each row execute function public.notifications_after_membership_insert();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
