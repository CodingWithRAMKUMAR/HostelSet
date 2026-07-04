-- Keep the existing tenant import workflow unchanged while making pgcrypto
-- resolution explicit for security-definer functions with an empty search_path.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  pgcrypto_schema name;
begin
  select namespace.nspname
  into pgcrypto_schema
  from pg_extension pg_ext
  join pg_namespace namespace on namespace.oid = pg_ext.extnamespace
  where pg_ext.extname = 'pgcrypto';

  if pgcrypto_schema is distinct from 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end $$;

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

  next_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.existing_tenant_import_links(property_id, owner_id, token, is_active, generated_at)
  values (p_property_id, property_owner, next_token, true, now())
  on conflict(property_id) do update
    set owner_id = excluded.owner_id, token = excluded.token, is_active = true, generated_at = now(), updated_at = now();
  return next_token;
end;
$$;

revoke all on function public.rotate_existing_tenant_import_link(uuid) from public, anon;
grant execute on function public.rotate_existing_tenant_import_link(uuid) to authenticated;
