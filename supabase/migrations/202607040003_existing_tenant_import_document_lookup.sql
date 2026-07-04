-- Speed up owner tenant-profile document lookup for approved imports.

create index if not exists existing_tenant_imports_tenant_approved_idx
  on public.existing_tenant_imports(tenant_id, property_id, processed_at desc)
  where tenant_id is not null and status = 'approved';
