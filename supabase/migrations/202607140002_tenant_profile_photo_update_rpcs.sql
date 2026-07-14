create or replace function public.update_my_tenant_profile_photo(p_profile_photo_path text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
begin
  select * into tenant_record
  from public.tenants
  where user_id = auth.uid()
    and status in ('active','notice_period','payment_pending')
  limit 1;

  if tenant_record.id is null then
    raise exception 'Tenant not found';
  end if;

  if p_profile_photo_path is null
    or p_profile_photo_path not like tenant_record.property_id::text || '/profile-photos/' || tenant_record.id::text || '/%'
    or p_profile_photo_path like '%..%'
    or p_profile_photo_path ~* '(^|/)(identity|id-proof|aadhaar|aadhar|payments)(/|$)' then
    raise exception 'Invalid profile photo path';
  end if;

  update public.tenants
  set profile_photo_path = p_profile_photo_path,
      updated_at = now()
  where id = tenant_record.id
  returning * into tenant_record;

  return tenant_record;
end;
$$;

create or replace function public.update_owned_tenant_profile_photo(p_tenant_id uuid, p_profile_photo_path text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  property_owner uuid;
begin
  select * into tenant_record
  from public.tenants
  where id = p_tenant_id
    and status in ('active','notice_period','payment_pending')
  for update;

  if tenant_record.id is null then
    raise exception 'Tenant not found';
  end if;

  select owner_id into property_owner
  from public.properties
  where id = tenant_record.property_id;

  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized';
  end if;

  if p_profile_photo_path is null
    or p_profile_photo_path not like tenant_record.property_id::text || '/profile-photos/' || tenant_record.id::text || '/%'
    or p_profile_photo_path like '%..%'
    or p_profile_photo_path ~* '(^|/)(identity|id-proof|aadhaar|aadhar|payments)(/|$)' then
    raise exception 'Invalid profile photo path';
  end if;

  update public.tenants
  set profile_photo_path = p_profile_photo_path,
      updated_at = now()
  where id = tenant_record.id
  returning * into tenant_record;

  return tenant_record;
end;
$$;

revoke all on function public.update_my_tenant_profile_photo(text) from public, anon;
revoke all on function public.update_owned_tenant_profile_photo(uuid, text) from public, anon;
grant execute on function public.update_my_tenant_profile_photo(text) to authenticated;
grant execute on function public.update_owned_tenant_profile_photo(uuid, text) to authenticated;
