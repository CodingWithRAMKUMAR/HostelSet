-- Production-safe visitor application workflow.
-- Keeps identity/payment objects private and makes approvals atomic.

create extension if not exists pgcrypto;

alter table public.applications
  add column if not exists user_id uuid references public.users(id) on delete set null,
  add column if not exists payment_screenshot text,
  add column if not exists payment_transaction_id text,
  add column if not exists payment_amount numeric(12,2) not null default 0;

create unique index if not exists applications_one_active_phone_per_property
  on public.applications(property_id, phone) where status in ('pending', 'approved');
create unique index if not exists applications_one_active_email_per_property
  on public.applications(property_id, lower(email)) where status in ('pending', 'approved');
create unique index if not exists prebookings_one_active_phone_per_property
  on public.pre_bookings(property_id, phone) where status in ('pending', 'approved');
create unique index if not exists prebookings_one_active_email_per_property
  on public.pre_bookings(property_id, lower(email)) where status in ('pending', 'approved');

create index if not exists applications_property_status_created_idx
  on public.applications(property_id, status, created_at desc);
create index if not exists prebookings_property_status_created_idx
  on public.pre_bookings(property_id, status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-documents', 'tenant-documents', false, 5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_documents_owner_read on storage.objects;
create policy tenant_documents_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'tenant-documents'
  and (
    public.is_hostelset_admin()
    or exists (
      select 1 from public.properties property
      where property.owner_id = auth.uid()
        and property.id::text = (storage.foldername(name))[1]
    )
    or exists (
      select 1 from public.applications application
      where application.user_id = auth.uid()
        and application.property_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Browser clients cannot upload, overwrite, or delete KYC/payment objects.
drop policy if exists tenant_documents_authenticated_insert on storage.objects;
drop policy if exists tenant_documents_anon_insert on storage.objects;
drop policy if exists tenant_documents_authenticated_update on storage.objects;
drop policy if exists tenant_documents_authenticated_delete on storage.objects;

create or replace function public.approve_application_atomic(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  tenant_id uuid;
begin
  select * into application_record from public.applications
  where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;

  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  select * into room_record from public.rooms where id = application_record.room_id for update;
  if room_record.id is null or room_record.property_id <> application_record.property_id then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if application_record.user_id is null then raise exception 'Applicant account is missing'; end if;

  if exists (
    select 1 from public.tenants
    where property_id = application_record.property_id
      and (user_id = application_record.user_id or phone = application_record.phone)
      and status in ('active', 'payment_pending')
  ) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id
  ) values (
    application_record.user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id
  ) returning id into tenant_id;

  if coalesce(application_record.payment_amount, 0) > 0 then
    insert into public.payment_history (
      tenant_id, amount, payment_date, payment_method, status,
      upi_transaction_id, payment_screenshot
    ) values (
      tenant_id, application_record.payment_amount, current_date, 'advance',
      'payment_pending', application_record.payment_transaction_id, application_record.payment_screenshot
    );
  end if;

  update public.rooms
  set current_occupants = coalesce(current_occupants, 0) + 1,
      status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end
  where id = room_record.id;
  update public.applications set status = 'approved', processed_at = now() where id = application_record.id;

  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
end;
$$;

create or replace function public.approve_prebooking_atomic(p_booking_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.pre_bookings%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  tenant_id uuid;
  paid numeric;
begin
  select * into booking from public.pre_bookings where id = p_booking_id for update;
  if booking.id is null then raise exception 'Pre-booking not found'; end if;
  if booking.status <> 'pending' then raise exception 'Pre-booking has already been processed'; end if;
  select owner_id into property_owner from public.properties where id = booking.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  select * into room_record from public.rooms where id = booking.room_id for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if p_user_id is null then raise exception 'Applicant account is missing'; end if;

  paid := greatest(0, coalesce(booking.pre_booking_fee_amount, 0));
  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status
  ) values (
    p_user_id, booking.property_id, booking.room_id, booking.name, booking.phone, booking.email,
    room_record.monthly_rent, greatest(0, room_record.monthly_rent - paid), paid,
    case when room_record.monthly_rent <= paid then 'paid' else 'pending' end,
    booking.expected_move_in_date, 'active'
  ) returning id into tenant_id;

  if paid > 0 then
    insert into public.payment_history (
      tenant_id, amount, payment_date, payment_method, status,
      upi_transaction_id, payment_screenshot
    ) values (
      tenant_id, paid, current_date, 'pre_booking', 'success',
      booking.payment_transaction_id, booking.payment_screenshot
    );
  end if;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1,
    status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end
  where id = room_record.id;
  update public.pre_bookings set status = 'approved', user_id = p_user_id, updated_at = now() where id = booking.id;
  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', booking.email);
end;
$$;

revoke all on function public.approve_application_atomic(uuid) from public, anon;
revoke all on function public.approve_prebooking_atomic(uuid, uuid) from public, anon;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
grant execute on function public.approve_prebooking_atomic(uuid, uuid) to authenticated;
