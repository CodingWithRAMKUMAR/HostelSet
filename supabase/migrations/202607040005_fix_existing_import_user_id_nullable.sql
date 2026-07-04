-- Pending Existing Tenant Import submissions are created before an Auth user is
-- invited, so user_id must remain nullable until owner approval.

alter table public.existing_tenant_imports
  alter column user_id drop not null;
