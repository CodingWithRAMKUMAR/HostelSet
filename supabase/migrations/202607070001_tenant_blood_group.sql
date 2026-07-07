-- Optional private blood-group data carried from application/import intake to tenants.
alter table public.tenants add column if not exists blood_group text;
alter table public.applications add column if not exists blood_group text;
alter table public.existing_tenant_imports add column if not exists blood_group text;

alter table public.tenants drop constraint if exists tenants_blood_group_check;
alter table public.tenants add constraint tenants_blood_group_check
  check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
alter table public.applications drop constraint if exists applications_blood_group_check;
alter table public.applications add constraint applications_blood_group_check
  check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
alter table public.existing_tenant_imports drop constraint if exists existing_tenant_imports_blood_group_check;
alter table public.existing_tenant_imports add constraint existing_tenant_imports_blood_group_check
  check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

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
  select * into application_record from public.applications where id = p_application_id for update;
  if application_record.id is null then raise exception 'Application not found'; end if;
  if application_record.status <> 'pending' then raise exception 'Application has already been processed'; end if;
  select owner_id into property_owner from public.properties where id = application_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  select * into room_record from public.rooms where id = application_record.room_id for update;
  if room_record.id is null or room_record.property_id <> application_record.property_id then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'The selected room is full'; end if;
  if application_record.user_id is null then raise exception 'Applicant account is missing'; end if;
  if exists (select 1 from public.tenants where property_id = application_record.property_id and (user_id = application_record.user_id or phone = application_record.phone) and status in ('active', 'payment_pending')) then raise exception 'Applicant already has a tenant record'; end if;

  insert into public.tenants (
    user_id, property_id, room_id, name, phone, email, blood_group, rent_amount,
    pending_amount, total_paid, rent_status, move_in_date, status,
    payment_screenshot, upi_transaction_id,
    security_deposit_amount, security_deposit_status, security_deposit_refund_status
  ) values (
    application_record.user_id, application_record.property_id, application_record.room_id,
    application_record.name, application_record.phone, application_record.email, application_record.blood_group,
    room_record.monthly_rent, room_record.monthly_rent, 0, 'pending', current_date, 'active',
    application_record.payment_screenshot, application_record.payment_transaction_id,
    greatest(0, coalesce(application_record.payment_amount, 0)),
    case when coalesce(application_record.payment_amount, 0) > 0 then 'pending' else 'not_required' end,
    'not_refunded'
  ) returning id into tenant_id;
  if coalesce(application_record.payment_amount, 0) > 0 then
    insert into public.payment_history (tenant_id, amount, payment_date, payment_method, status, upi_transaction_id, payment_screenshot)
    values (tenant_id, application_record.payment_amount, current_date, 'security_deposit', 'payment_pending', application_record.payment_transaction_id, application_record.payment_screenshot);
  end if;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1, status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end where id = room_record.id;
  update public.applications set status = 'approved', processed_at = now() where id = application_record.id;
  return jsonb_build_object('success', true, 'tenant_id', tenant_id, 'email', application_record.email);
end;
$$;

create or replace function public.approve_existing_tenant_import_with_user(p_import_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.existing_tenant_imports%rowtype;
  room_record public.rooms%rowtype;
  property_owner uuid;
  effective_user_id uuid;
  new_tenant_id uuid;
begin
  if p_user_id is null then raise exception 'Tenant account is missing'; end if;
  select * into import_record from public.existing_tenant_imports where id = p_import_id for update;
  if import_record.id is null then raise exception 'Import submission not found'; end if;
  select owner_id into property_owner from public.properties where id = import_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then raise exception 'Not authorized'; end if;
  if import_record.status = 'approved' then return jsonb_build_object('success', true, 'tenant_id', import_record.tenant_id, 'status', 'approved'); end if;
  if import_record.status <> 'pending_owner_review' then raise exception 'Import submission has already been processed'; end if;
  effective_user_id := coalesce(import_record.user_id, p_user_id);
  select * into room_record from public.rooms where id = import_record.room_id and property_id = import_record.property_id for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if coalesce(room_record.current_occupants, 0) >= room_record.capacity then raise exception 'Selected room is full'; end if;
  if exists (select 1 from public.tenants tenant where tenant.property_id = import_record.property_id and (tenant.user_id = effective_user_id or tenant.phone = import_record.phone or lower(tenant.email) = lower(import_record.email)) and tenant.status in ('active','notice_period','payment_pending')) then raise exception 'Tenant already exists for this property'; end if;
  insert into public.tenants(user_id, property_id, room_id, name, phone, email, blood_group, rent_amount, pending_amount, total_paid, rent_status, move_in_date, status)
  values (effective_user_id, import_record.property_id, import_record.room_id, import_record.full_name, import_record.phone, import_record.email, import_record.blood_group, import_record.current_rent, 0, 0, 'paid', import_record.move_in_date, 'active')
  returning id into new_tenant_id;
  update public.rooms set current_occupants = coalesce(current_occupants, 0) + 1, status = case when coalesce(current_occupants, 0) + 1 >= capacity then 'occupied' else 'vacant' end, updated_at = now() where id = room_record.id;
  update public.existing_tenant_imports set status = 'approved', user_id = effective_user_id, tenant_id = new_tenant_id, rejection_reason = null, processed_at = now(), processed_by = auth.uid(), updated_at = now() where id = import_record.id;
  return jsonb_build_object('success', true, 'tenant_id', new_tenant_id, 'status', 'approved');
end;
$$;

revoke all on function public.approve_application_atomic(uuid) from public, anon;
grant execute on function public.approve_application_atomic(uuid) to authenticated;
revoke all on function public.approve_existing_tenant_import_with_user(uuid, uuid) from public, anon;
grant execute on function public.approve_existing_tenant_import_with_user(uuid, uuid) to authenticated;

drop function if exists public.create_owner_tenant_atomic(uuid,uuid,uuid,uuid,text,text,text,numeric,integer,numeric);
create function public.create_owner_tenant_atomic(
  p_owner_id uuid, p_user_id uuid, p_property_id uuid, p_room_id uuid,
  p_name text, p_phone text, p_email text, p_blood_group text,
  p_monthly_rent numeric, p_advance_months integer, p_joining_fee numeric
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  room_record public.rooms%rowtype;
  tenant_id uuid;
  initial_payment numeric;
  initial_pending numeric;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_owner_id is null or p_user_id is null then raise exception 'Owner and tenant accounts are required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Tenant name is required'; end if;
  if nullif(trim(p_email), '') is null or nullif(trim(p_phone), '') is null then raise exception 'Tenant contact details are required'; end if;
  if p_blood_group is not null and p_blood_group not in ('A+','A-','B+','B-','AB+','AB-','O+','O-') then raise exception 'Invalid blood group'; end if;
  if p_monthly_rent is null or p_monthly_rent <= 0 then raise exception 'Monthly rent must be greater than zero'; end if;
  if p_advance_months is null or p_advance_months < 0 or p_advance_months > 24 then raise exception 'Advance months must be between 0 and 24'; end if;
  if p_joining_fee is null or p_joining_fee < 0 then raise exception 'Joining fee cannot be negative'; end if;
  if not exists (select 1 from public.properties property where property.id = p_property_id and property.owner_id = p_owner_id) then raise exception 'Property does not belong to this owner'; end if;
  select * into room_record from public.rooms where id = p_room_id and property_id = p_property_id for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if room_record.current_occupants >= room_record.capacity then raise exception 'Selected room is full'; end if;
  if exists (select 1 from public.tenants tenant where tenant.property_id = p_property_id and (tenant.user_id = p_user_id or tenant.phone = trim(p_phone) or lower(tenant.email) = lower(trim(p_email))) and tenant.status in ('active','notice_period','payment_pending')) then raise exception 'Tenant already exists for this property'; end if;
  initial_payment := (p_monthly_rent * p_advance_months) + p_joining_fee;
  initial_pending := case when p_advance_months > 0 then 0 else p_monthly_rent end;
  insert into public.users(id,email,full_name,phone,role,is_active) values(p_user_id,lower(trim(p_email)),trim(p_name),trim(p_phone),'tenant',true);
  insert into public.tenants(user_id,property_id,room_id,name,phone,email,blood_group,rent_amount,pending_amount,total_paid,rent_status,move_in_date,status)
  values(p_user_id,p_property_id,p_room_id,trim(p_name),trim(p_phone),lower(trim(p_email)),p_blood_group,p_monthly_rent,initial_pending,initial_payment,case when p_advance_months > 0 then 'paid' else 'pending' end,current_date,'active')
  returning id into tenant_id;
  if initial_payment > 0 then insert into public.payment_history(tenant_id,amount,payment_date,payment_method,status) values(tenant_id,initial_payment,current_date,'advance','success'); end if;
  update public.rooms set current_occupants = current_occupants + 1, status = case when current_occupants + 1 >= capacity then 'occupied' else 'vacant' end, updated_at = now() where id = room_record.id;
  return jsonb_build_object('success',true,'tenant_id',tenant_id,'initial_payment',initial_payment,'pending_amount',initial_pending);
end;
$$;

revoke all on function public.create_owner_tenant_atomic(uuid,uuid,uuid,uuid,text,text,text,text,numeric,integer,numeric) from public,anon,authenticated;
grant execute on function public.create_owner_tenant_atomic(uuid,uuid,uuid,uuid,text,text,text,text,numeric,integer,numeric) to service_role;

drop function if exists public.update_tenant_profile(text, text);
create function public.update_tenant_profile(p_name text, p_phone text, p_blood_group text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tenant_id uuid; clean_name text := nullif(trim(p_name), ''); clean_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if clean_name is null or length(clean_name) > 120 then raise exception 'A valid name is required'; end if;
  if clean_phone is not null and clean_phone !~ '^[0-9]{10}$' then raise exception 'Phone must contain 10 digits'; end if;
  if p_blood_group is not null and p_blood_group not in ('A+','A-','B+','B-','AB+','AB-','O+','O-') then raise exception 'Invalid blood group'; end if;
  update public.tenants set name = clean_name, phone = clean_phone, blood_group = p_blood_group where user_id = auth.uid() and status in ('active', 'notice_period', 'payment_pending') returning id into tenant_id;
  if tenant_id is null then raise exception 'Active tenant record not found'; end if;
  update public.users set full_name = clean_name, phone = clean_phone where id = auth.uid();
  return jsonb_build_object('success', true, 'tenant_id', tenant_id);
end;
$$;
revoke all on function public.update_tenant_profile(text, text, text) from public, anon;
grant execute on function public.update_tenant_profile(text, text, text) to authenticated;
