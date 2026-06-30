-- Provider-independent property location data. Coordinates are stored in
-- standard WGS84 so the map provider can be changed without a data migration.

alter table public.properties
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists formatted_address text,
  add column if not exists location_place_id text,
  add column if not exists location_verified boolean not null default false,
  add column if not exists nearby_landmark text;

alter table public.properties drop constraint if exists properties_latitude_valid;
alter table public.properties add constraint properties_latitude_valid
  check (latitude is null or latitude between -90 and 90);
alter table public.properties drop constraint if exists properties_longitude_valid;
alter table public.properties add constraint properties_longitude_valid
  check (longitude is null or longitude between -180 and 180);
alter table public.properties drop constraint if exists properties_location_pair_valid;
alter table public.properties add constraint properties_location_pair_valid
  check ((latitude is null) = (longitude is null));

create index if not exists properties_active_location_idx
  on public.properties(latitude, longitude)
  where is_active and latitude is not null and longitude is not null;

create index if not exists properties_location_place_id_idx
  on public.properties(location_place_id)
  where location_place_id is not null;
