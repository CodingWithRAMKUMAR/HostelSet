-- Allow property owners to read legacy application documents whose database
-- fields contain old root paths or full tenant-documents public URLs.
drop policy if exists tenant_documents_owner_legacy_application_read on storage.objects;
create policy tenant_documents_owner_legacy_application_read
on storage.objects for select to authenticated
using (
  bucket_id = 'tenant-documents'
  and (
    public.is_hostelset_admin()
    or exists (
      select 1
      from public.applications application
      join public.properties property on property.id = application.property_id
      where property.owner_id = auth.uid()
        and (
          application.photo = storage.objects.name
          or application.id_proof = storage.objects.name
          or application.payment_screenshot = storage.objects.name
          or application.photo like '%/tenant-documents/' || storage.objects.name
          or application.id_proof like '%/tenant-documents/' || storage.objects.name
          or application.payment_screenshot like '%/tenant-documents/' || storage.objects.name
        )
    )
    or exists (
      select 1
      from public.pre_bookings booking
      join public.properties property on property.id = booking.property_id
      where property.owner_id = auth.uid()
        and (
          booking.photo = storage.objects.name
          or booking.id_proof = storage.objects.name
          or booking.payment_screenshot = storage.objects.name
          or booking.photo like '%/tenant-documents/' || storage.objects.name
          or booking.id_proof like '%/tenant-documents/' || storage.objects.name
          or booking.payment_screenshot like '%/tenant-documents/' || storage.objects.name
        )
    )
  )
);

