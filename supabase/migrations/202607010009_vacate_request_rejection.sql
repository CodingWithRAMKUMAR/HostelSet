-- Atomic, permission-checked vacate rejection with retained audit history.

alter table public.check_out_requests
  add column if not exists rejection_reason text;

create or replace function public.reject_vacate_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.check_out_requests%rowtype;
  property_owner uuid;
  clean_reason text;
begin
  if p_request_id is null then raise exception 'Vacate request ID is required'; end if;
  if length(coalesce(p_rejection_reason, '')) > 2000 then raise exception 'Rejection reason is too long'; end if;

  select * into request_record
  from public.check_out_requests
  where id = p_request_id
  for update;

  if request_record.id is null then raise exception 'Vacate request not found'; end if;

  select owner_id into property_owner
  from public.properties
  where id = request_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized to reject this vacate request';
  end if;

  if request_record.status = 'rejected' then
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'status', 'rejected',
      'rejection_reason', request_record.rejection_reason
    );
  end if;
  if request_record.status <> 'pending' then
    raise exception 'Only a pending vacate request can be rejected';
  end if;

  clean_reason := nullif(trim(p_rejection_reason), '');
  update public.check_out_requests
  set status = 'rejected',
      rejection_reason = clean_reason,
      processed_at = now(),
      updated_at = now()
  where id = request_record.id;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'status', 'rejected',
    'rejection_reason', clean_reason
  );
end;
$$;

revoke all on function public.reject_vacate_request(uuid,text)
  from public, anon;
grant execute on function public.reject_vacate_request(uuid,text)
  to authenticated;
