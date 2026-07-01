-- HostelSet core database baseline.
-- This migration intentionally sorts before every incremental migration so a
-- fresh Supabase project can be built without relying on manually-created SQL.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role text not null default 'tenant' check (role in ('admin','owner','tenant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_lower_uidx on public.users(lower(email));
create unique index if not exists users_phone_uidx on public.users(phone) where phone is not null;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  address text not null,
  city text not null,
  pincode text,
  property_type text not null default 'boys',
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  contact_number text,
  owner_upi_id text,
  is_active boolean not null default true,
  membership_active boolean not null default false,
  membership_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_owner_id_idx on public.properties(owner_id);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_number text not null,
  sharing_type text not null,
  monthly_rent numeric(12,2) not null check (monthly_rent >= 0),
  capacity integer not null check (capacity > 0),
  current_occupants integer not null default 0 check (current_occupants >= 0),
  status text not null default 'vacant'
    check (status in ('vacant','occupied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_property_number_unique unique(property_id, room_number),
  constraint rooms_occupancy_valid check (current_occupants <= capacity)
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  name text not null,
  phone text,
  email text,
  rent_amount numeric(12,2) not null default 0 check (rent_amount >= 0),
  pending_amount numeric(12,2) not null default 0 check (pending_amount >= 0),
  total_paid numeric(12,2) not null default 0 check (total_paid >= 0),
  rent_status text not null default 'pending'
    check (rent_status in ('pending','paid','payment_pending')),
  move_in_date date not null default current_date,
  status text not null default 'active'
    check (status in ('active','notice_period','payment_pending','inactive')),
  last_payment_date date,
  check_out_requested boolean not null default false,
  notice_period_start date,
  notice_period_end date,
  payment_screenshot text,
  upi_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tenants_one_current_user_uidx on public.tenants(user_id) where status in ('active','notice_period','payment_pending');

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null,
  status text not null default 'payment_pending'
    check (status in ('payment_pending','success')),
  upi_transaction_id text,
  payment_screenshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  name text not null,
  phone text not null,
  email text not null,
  message text,
  id_proof text,
  photo text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  expected_move_in date,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_user_idx
  on public.applications(user_id) where user_id is not null;

create table if not exists public.pre_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  name text not null,
  phone text not null,
  email text not null,
  message text,
  expected_move_in_date date not null,
  id_proof text,
  photo text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending')),
  pre_booking_fee_amount numeric(12,2) not null default 0 check (pre_booking_fee_amount >= 0),
  payment_screenshot text,
  payment_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  tenant_name text,
  room_number text,
  title text not null,
  description text not null,
  priority text not null default 'medium',
  status text not null default 'open'
    check (status in ('open','in_progress','resolved')),
  admin_response text,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_out_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_name text,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_number text,
  expected_check_out date not null,
  reason text,
  requested_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  old_room_id uuid not null references public.rooms(id) on delete restrict,
  new_room_id uuid not null references public.rooms(id) on delete restrict,
  reason text,
  rejection_reason text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_change_different_rooms check (old_room_id <> new_room_id)
);
create unique index if not exists room_change_one_pending_per_tenant_uidx on public.room_change_requests(tenant_id) where status = 'pending';

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  title text not null,
  content text not null,
  type text not null default 'general'
    check (type in ('general','urgent','maintenance','payment','event','emergency')),
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  joining_fee numeric(12,2) not null default 0 check (joining_fee >= 0),
  advance_months integer not null default 1 check (advance_months >= 0),
  due_day integer not null default 5 check (due_day between 1 and 28),
  pre_booking_fee numeric(12,2) not null default 0 check (pre_booking_fee >= 0),
  upi_id text,
  upi_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_settings_owner_unique unique(owner_id),
  constraint owner_settings_property_unique unique(property_id)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('property-photos','property-photos',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('tenant-documents','tenant-documents',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.register_owner_and_property(
  p_user_id uuid, p_phone text, p_email text, p_full_name text,
  p_property_name text, p_description text, p_address text, p_city text,
  p_pincode text, p_property_type text, p_amenities text[], p_photos text[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_property_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  insert into public.users(id,email,full_name,phone,role,is_active)
  values(p_user_id,lower(trim(p_email)),trim(p_full_name),p_phone,'owner',true)
  on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,phone=excluded.phone,role='owner',is_active=true,updated_at=now();
  insert into public.properties(owner_id,name,description,address,city,pincode,property_type,amenities,photos)
  values(p_user_id,trim(p_property_name),p_description,trim(p_address),trim(p_city),p_pincode,p_property_type,coalesce(p_amenities,'{}'),coalesce(p_photos,'{}'))
  returning id into new_property_id;
  insert into public.owner_settings(owner_id,property_id) values(p_user_id,new_property_id)
  on conflict(owner_id) do update set property_id=excluded.property_id,updated_at=now();
  return jsonb_build_object('success',true,'property_id',new_property_id);
exception when unique_violation then
  return jsonb_build_object('success',false,'error','Owner or property already exists');
end $$;
revoke all on function public.register_owner_and_property(uuid,text,text,text,text,text,text,text,text,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.register_owner_and_property(uuid,text,text,text,text,text,text,text,text,text,text[],text[]) to service_role;
