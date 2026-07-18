-- Allow HostelSet admins and property owners to attach a public image to a notice.
-- Images are stored in the existing public property-photos bucket; the column
-- contains only the generated HTTPS public URL.

alter table public.notices
  add column if not exists image_url text;

alter table public.notices
  drop constraint if exists notices_image_url_check;

alter table public.notices
  add constraint notices_image_url_check
  check (
    image_url is null
    or (
      char_length(image_url) <= 2048
      and image_url ~ '^https://[A-Za-z0-9.-]+/storage/v1/object/public/property-photos/'
    )
  );

comment on column public.notices.image_url is
  'Optional public image URL stored in the property-photos bucket.';

grant select, insert, update, delete on public.notices to authenticated;
