-- Complete one-owner-to-many-properties support and make manual tenant creation atomic.

alter table public.owner_settings
  drop constraint if exists owner_settings_owner_unique;

create index if not exists owner_settings_owner_idx
  on public.owner_settings(owner_id);

drop index if exists public.membership_requests_one_pending_per_owner;
create unique index if not exists membership_requests_one_pending_per_property
  on public.membership_requests(owner_id, property_id)
  where status = 'pending';

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
  on conflict(property_id) do update set owner_id=excluded.owner_id,updated_at=now();
  return jsonb_build_object('success',true,'property_id',new_property_id);
exception when unique_violation then
  return jsonb_build_object('success',false,'error','Owner or property already exists');
end $$;

revoke all on function public.register_owner_and_property(uuid,text,text,text,text,text,text,text,text,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.register_owner_and_property(uuid,text,text,text,text,text,text,text,text,text,text[],text[]) to service_role;

create or replace function public.create_owner_tenant_atomic(
  p_owner_id uuid,
  p_user_id uuid,
  p_property_id uuid,
  p_room_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_monthly_rent numeric,
  p_advance_months integer,
  p_joining_fee numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if p_monthly_rent is null or p_monthly_rent <= 0 then raise exception 'Monthly rent must be greater than zero'; end if;
  if p_advance_months is null or p_advance_months < 0 or p_advance_months > 24 then raise exception 'Advance months must be between 0 and 24'; end if;
  if p_joining_fee is null or p_joining_fee < 0 then raise exception 'Joining fee cannot be negative'; end if;

  if not exists (
    select 1 from public.properties property
    where property.id = p_property_id and property.owner_id = p_owner_id
  ) then raise exception 'Property does not belong to this owner'; end if;

  select * into room_record
  from public.rooms
  where id = p_room_id and property_id = p_property_id
  for update;
  if room_record.id is null then raise exception 'Room not found'; end if;
  if room_record.current_occupants >= room_record.capacity then raise exception 'Selected room is full'; end if;

  if exists (
    select 1 from public.tenants tenant
    where tenant.property_id = p_property_id
      and (tenant.user_id = p_user_id or tenant.phone = trim(p_phone) or lower(tenant.email) = lower(trim(p_email)))
      and tenant.status in ('active','notice_period','payment_pending')
  ) then raise exception 'Tenant already exists for this property'; end if;

  initial_payment := (p_monthly_rent * p_advance_months) + p_joining_fee;
  initial_pending := case when p_advance_months > 0 then 0 else p_monthly_rent end;

  insert into public.users(id,email,full_name,phone,role,is_active)
  values(p_user_id,lower(trim(p_email)),trim(p_name),trim(p_phone),'tenant',true);

  insert into public.tenants(
    user_id,property_id,room_id,name,phone,email,rent_amount,pending_amount,
    total_paid,rent_status,move_in_date,status
  ) values (
    p_user_id,p_property_id,p_room_id,trim(p_name),trim(p_phone),lower(trim(p_email)),
    p_monthly_rent,initial_pending,initial_payment,
    case when p_advance_months > 0 then 'paid' else 'pending' end,
    current_date,'active'
  ) returning id into tenant_id;

  if initial_payment > 0 then
    insert into public.payment_history(tenant_id,amount,payment_date,payment_method,status)
    values(tenant_id,initial_payment,current_date,'advance','success');
  end if;

  update public.rooms
  set current_occupants = current_occupants + 1,
      status = case when current_occupants + 1 >= capacity then 'occupied' else 'vacant' end,
      updated_at = now()
  where id = room_record.id;

  return jsonb_build_object('success',true,'tenant_id',tenant_id,'initial_payment',initial_payment,'pending_amount',initial_pending);
end;
$$;

revoke all on function public.create_owner_tenant_atomic(uuid,uuid,uuid,uuid,text,text,text,numeric,integer,numeric) from public,anon,authenticated;
grant execute on function public.create_owner_tenant_atomic(uuid,uuid,uuid,uuid,text,text,text,numeric,integer,numeric) to service_role;
