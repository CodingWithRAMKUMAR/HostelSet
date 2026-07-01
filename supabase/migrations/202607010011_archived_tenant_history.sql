-- Read-only archived tenant history without duplicating business records.

alter table public.tenants
  add column if not exists archived_at timestamptz;

update public.tenants
set archived_at = coalesce(archived_at, updated_at, now())
where status = 'inactive' and archived_at is null;

create or replace function public.protect_archived_tenant_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status = 'inactive' then
    raise exception 'Archived tenants cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and old.status = 'inactive' then
    raise exception 'Archived tenants cannot be modified';
  end if;
  if tg_op = 'UPDATE' and new.status = 'inactive' then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tenants_protect_archived_history on public.tenants;
create trigger tenants_protect_archived_history
before update or delete on public.tenants
for each row execute function public.protect_archived_tenant_history();

create or replace function public.get_archived_tenant_history(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tenant_record public.tenants%rowtype;
  property_owner uuid;
  room_number text;
  checkout_date date;
  payments jsonb;
  rents jsonb;
  complaints jsonb;
  ratings jsonb;
  checkouts jsonb;
  room_changes jsonb;
begin
  select * into tenant_record
  from public.tenants
  where id = p_tenant_id and status = 'inactive';
  if tenant_record.id is null then raise exception 'Archived tenant not found'; end if;

  select owner_id into property_owner
  from public.properties where id = tenant_record.property_id;
  if property_owner is distinct from auth.uid() and not public.is_hostelset_admin() then
    raise exception 'Not authorized to view this archived tenant';
  end if;

  select room.room_number into room_number
  from public.rooms room where room.id = tenant_record.room_id;

  select coalesce(jsonb_agg(to_jsonb(payment) order by payment.payment_date desc, payment.created_at desc), '[]'::jsonb)
  into payments from public.payment_history payment where payment.tenant_id = tenant_record.id;

  select coalesce(jsonb_agg(to_jsonb(rent) order by rent.period_start desc), '[]'::jsonb)
  into rents from public.rent_records rent where rent.tenant_id = tenant_record.id;

  select coalesce(jsonb_agg(to_jsonb(complaint) order by complaint.created_at desc), '[]'::jsonb)
  into complaints from public.complaints complaint where complaint.tenant_id = tenant_record.id;

  select coalesce(jsonb_agg(to_jsonb(rating) order by rating.created_at desc), '[]'::jsonb)
  into ratings from public.ratings rating where rating.tenant_id = tenant_record.id;

  select coalesce(jsonb_agg(to_jsonb(request) order by request.created_at desc), '[]'::jsonb)
  into checkouts from public.check_out_requests request where request.tenant_id = tenant_record.id;

  select max(request.expected_check_out)
  into checkout_date
  from public.check_out_requests request
  where request.tenant_id = tenant_record.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', change.id,
    'status', change.status,
    'reason', change.reason,
    'rejection_reason', change.rejection_reason,
    'requested_at', change.requested_at,
    'processed_at', change.processed_at,
    'old_room_id', change.old_room_id,
    'old_room_number', old_room.room_number,
    'new_room_id', change.new_room_id,
    'new_room_number', new_room.room_number
  ) order by change.requested_at desc), '[]'::jsonb)
  into room_changes
  from public.room_change_requests change
  left join public.rooms old_room on old_room.id = change.old_room_id
  left join public.rooms new_room on new_room.id = change.new_room_id
  where change.tenant_id = tenant_record.id;

  return jsonb_build_object(
    'tenant', to_jsonb(tenant_record) || jsonb_build_object('room_number', room_number, 'checkout_date', coalesce(tenant_record.notice_period_end, checkout_date)),
    'payments', payments,
    'rents', rents,
    'complaints', complaints,
    'ratings', ratings,
    'checkouts', checkouts,
    'room_changes', room_changes
  );
end;
$$;

revoke all on function public.protect_archived_tenant_history() from public,anon,authenticated;
revoke all on function public.get_archived_tenant_history(uuid) from public,anon;
grant execute on function public.get_archived_tenant_history(uuid) to authenticated;
