-- Preserve compatibility for legacy owner/admin callers while keeping one
-- atomic, permission-checked application approval implementation.
create or replace function public.admin_approve_application(application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.approve_application_atomic(application_id);
end;
$$;

revoke all on function public.admin_approve_application(uuid)
  from public, anon;
grant execute on function public.admin_approve_application(uuid)
  to authenticated;

