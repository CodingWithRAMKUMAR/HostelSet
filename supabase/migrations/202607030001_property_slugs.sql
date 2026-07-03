-- Stable, SEO-friendly public property identifiers.

alter table public.properties add column if not exists slug text;

create or replace function public.property_slug_base(p_name text, p_city text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(concat_ws('-', nullif(trim(p_name), ''), nullif(trim(p_city), ''))), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

with candidates as (
  select
    id,
    coalesce(nullif(public.property_slug_base(name, city), ''), 'property-' || left(id::text, 8)) as base_slug,
    row_number() over (
      partition by coalesce(nullif(public.property_slug_base(name, city), ''), 'property-' || left(id::text, 8))
      order by created_at, id
    ) as duplicate_number
  from public.properties
  where slug is null
)
update public.properties property
set slug = case
  when candidate.duplicate_number = 1
    and not exists (select 1 from public.properties existing where existing.slug = candidate.base_slug)
    then candidate.base_slug
  else candidate.base_slug || '-' || left(property.id::text, 8)
end
from candidates candidate
where property.id = candidate.id;

create unique index if not exists properties_slug_uidx
  on public.properties(slug)
  where slug is not null;

create or replace function public.set_property_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_slug text;
begin
  if tg_op = 'UPDATE' then
    new.slug := old.slug;
    return new;
  end if;

  base_slug := coalesce(
    nullif(public.property_slug_base(new.name, new.city), ''),
    'property-' || left(new.id::text, 8)
  );

  perform pg_advisory_xact_lock(hashtextextended(base_slug, 0));
  new.slug := case
    when exists (select 1 from public.properties property where property.slug = base_slug)
      then base_slug || '-' || left(new.id::text, 8)
    else base_slug
  end;
  return new;
end;
$$;

drop trigger if exists properties_set_slug on public.properties;
create trigger properties_set_slug
before insert or update of slug on public.properties
for each row execute function public.set_property_slug();

revoke all on function public.property_slug_base(text, text) from public, anon, authenticated;
revoke all on function public.set_property_slug() from public, anon, authenticated;
