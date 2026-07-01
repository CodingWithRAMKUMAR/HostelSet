-- Complete RLS, storage, RPC, index and realtime foundation.

-- RLS is explicitly enabled everywhere reached by browser clients.
alter table public.users enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.payment_history enable row level security;
alter table public.applications enable row level security;
alter table public.pre_bookings enable row level security;
alter table public.complaints enable row level security;
alter table public.check_out_requests enable row level security;
alter table public.room_change_requests enable row level security;
alter table public.notices enable row level security;
alter table public.owner_settings enable row level security;
alter table public.ratings enable row level security;

-- User self access. Admin access is supplied by the earlier admin policy.
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users for select to authenticated using (id = auth.uid());
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users for insert to authenticated with check (id=auth.uid() and role in ('owner','tenant'));
drop policy if exists users_owner_insert_tenant on public.users;
create policy users_owner_insert_tenant on public.users for insert to authenticated with check (
  role='tenant' and exists(select 1 from public.properties p where p.owner_id=auth.uid())
);

-- Active properties and their rooms are intentionally public catalogue data.
drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select to anon,authenticated using (is_active);
drop policy if exists properties_owner_manage on public.properties;
create policy properties_owner_manage on public.properties for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms for select to anon,authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.is_active));
drop policy if exists rooms_owner_manage on public.rooms;
create policy rooms_owner_manage on public.rooms for all to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists tenants_self_update on public.tenants;
create policy tenants_self_update on public.tenants for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists tenants_owner_manage on public.tenants;
create policy tenants_owner_manage on public.tenants for all to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists payments_tenant_access on public.payment_history;
drop policy if exists payments_tenant_read on public.payment_history;
create policy payments_tenant_read on public.payment_history for select to authenticated using (exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists payments_tenant_insert on public.payment_history;
create policy payments_tenant_insert on public.payment_history for insert to authenticated with check (status='payment_pending' and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists payments_owner_access on public.payment_history;
create policy payments_owner_access on public.payment_history for select to authenticated using (exists(select 1 from public.tenants t join public.properties p on p.id=t.property_id where t.id=tenant_id and p.owner_id=auth.uid()));
drop policy if exists payments_owner_insert on public.payment_history;
create policy payments_owner_insert on public.payment_history for insert to authenticated with check (
  status in ('success','payment_pending') and exists(select 1 from public.tenants t join public.properties p on p.id=t.property_id where t.id=tenant_id and p.owner_id=auth.uid())
);

drop policy if exists applications_participant_access on public.applications;
create policy applications_participant_access on public.applications for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
drop policy if exists applications_owner_update on public.applications;
create policy applications_owner_update on public.applications for update to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
drop policy if exists prebookings_participant_access on public.pre_bookings;
create policy prebookings_participant_access on public.pre_bookings for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
drop policy if exists prebookings_owner_update on public.pre_bookings;
create policy prebookings_owner_update on public.pre_bookings for update to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists complaints_tenant_manage on public.complaints;
drop policy if exists complaints_tenant_read on public.complaints;
create policy complaints_tenant_read on public.complaints for select to authenticated using (exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists complaints_tenant_insert on public.complaints;
create policy complaints_tenant_insert on public.complaints for insert to authenticated with check (status='open' and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid() and t.property_id=property_id));
drop policy if exists complaints_tenant_delete on public.complaints;
create policy complaints_tenant_delete on public.complaints for delete to authenticated using (status='open' and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists complaints_owner_manage on public.complaints;
create policy complaints_owner_manage on public.complaints for all to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists checkout_tenant_manage on public.check_out_requests;
drop policy if exists checkout_tenant_read on public.check_out_requests;
create policy checkout_tenant_read on public.check_out_requests for select to authenticated using (exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists checkout_tenant_insert on public.check_out_requests;
create policy checkout_tenant_insert on public.check_out_requests for insert to authenticated with check (status='pending' and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid() and t.property_id=property_id and t.room_id=room_id));
drop policy if exists checkout_tenant_delete on public.check_out_requests;
create policy checkout_tenant_delete on public.check_out_requests for delete to authenticated using (status in ('pending','approved') and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists checkout_owner_read on public.check_out_requests;
create policy checkout_owner_read on public.check_out_requests for select to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
drop policy if exists roomchange_tenant_manage on public.room_change_requests;
drop policy if exists roomchange_tenant_read on public.room_change_requests;
create policy roomchange_tenant_read on public.room_change_requests for select to authenticated using (exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid()));
drop policy if exists roomchange_tenant_insert on public.room_change_requests;
create policy roomchange_tenant_insert on public.room_change_requests for insert to authenticated with check (status='pending' and exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid() and t.property_id=property_id and t.room_id=old_room_id) and exists(select 1 from public.rooms r where r.id=new_room_id and r.property_id=property_id and r.current_occupants<r.capacity));
drop policy if exists roomchange_owner_manage on public.room_change_requests;
create policy roomchange_owner_manage on public.room_change_requests for all to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists notices_visible on public.notices;
create policy notices_visible on public.notices for select to authenticated using (public.is_hostelset_admin() or property_id is null or exists(select 1 from public.tenants t where t.property_id=notices.property_id and t.user_id=auth.uid()) or exists(select 1 from public.properties p where p.id=notices.property_id and p.owner_id=auth.uid()));
drop policy if exists notices_owner_manage on public.notices;
create policy notices_owner_manage on public.notices for all to authenticated using (public.is_hostelset_admin() or (property_id is not null and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()))) with check (public.is_hostelset_admin() or (property_id is not null and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())));
drop policy if exists settings_public_read on public.owner_settings;
create policy settings_public_read on public.owner_settings for select to anon,authenticated using (property_id is not null and exists(select 1 from public.properties p where p.id=property_id and p.is_active));
drop policy if exists settings_owner_manage on public.owner_settings;
create policy settings_owner_manage on public.owner_settings for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists ratings_tenant_insert on public.ratings;
create policy ratings_tenant_insert on public.ratings for insert to authenticated with check (exists(select 1 from public.tenants t where t.id=tenant_id and t.user_id=auth.uid() and t.property_id=property_id));

-- Atomic, permission-checked room transfer used by owner/admin dashboards.
create or replace function public.move_tenant_room(p_tenant_id uuid,p_new_room_id uuid,p_old_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.tenants%rowtype; oldr public.rooms%rowtype; newr public.rooms%rowtype;
begin
  select * into t from public.tenants where id=p_tenant_id for update;
  if t.id is null or t.room_id<>p_old_room_id then raise exception 'Tenant room changed; refresh and retry'; end if;
  if not public.is_hostelset_admin() and not exists(select 1 from public.properties p where p.id=t.property_id and p.owner_id=auth.uid()) then raise exception 'Not authorized'; end if;
  select * into oldr from public.rooms where id=p_old_room_id for update;
  select * into newr from public.rooms where id=p_new_room_id for update;
  if newr.id is null or oldr.id is null or newr.property_id<>t.property_id or oldr.property_id<>t.property_id then raise exception 'Invalid room'; end if;
  if newr.current_occupants>=newr.capacity then raise exception 'Requested room is full'; end if;
  update public.tenants set room_id=newr.id,rent_amount=newr.monthly_rent,updated_at=now() where id=t.id;
  update public.rooms set current_occupants=greatest(0,current_occupants-1),status=case when greatest(0,current_occupants-1)>=capacity then 'occupied' else 'vacant' end,updated_at=now() where id=oldr.id;
  update public.rooms set current_occupants=current_occupants+1,status=case when current_occupants+1>=capacity then 'occupied' else 'vacant' end,updated_at=now() where id=newr.id;
  update public.room_change_requests set status='approved',processed_at=now(),rejection_reason=null,updated_at=now()
  where tenant_id=t.id and old_room_id=oldr.id and new_room_id=newr.id and status='pending';
  update public.check_out_requests
  set status='cancelled',processed_at=coalesce(processed_at,now()),updated_at=now()
  where tenant_id=t.id and status in ('pending','approved');
  return jsonb_build_object('success',true,'room_id',newr.id);
end $$;
revoke all on function public.move_tenant_room(uuid,uuid,uuid) from public,anon;
grant execute on function public.move_tenant_room(uuid,uuid,uuid) to authenticated;

-- Foreign-key and common filter indexes not covered by earlier migrations.
-- Remove exact/redundant indexes created by earlier incremental migrations;
-- the retained unique/composite indexes serve the same query prefixes.
drop index if exists public.rooms_property_id_idx;
drop index if exists public.applications_property_status_created_idx;
drop index if exists public.prebookings_property_status_created_idx;
create index if not exists applications_user_idx on public.applications(user_id) where user_id is not null;
create index if not exists applications_room_idx on public.applications(room_id);
create index if not exists prebookings_user_idx on public.pre_bookings(user_id) where user_id is not null;
create index if not exists prebookings_room_idx on public.pre_bookings(room_id);
create index if not exists complaints_tenant_created_idx on public.complaints(tenant_id,created_at desc);
create index if not exists complaints_room_idx on public.complaints(room_id) where room_id is not null;
create index if not exists checkout_room_status_idx on public.check_out_requests(room_id,status);
create index if not exists roomchange_old_room_idx on public.room_change_requests(old_room_id);
create index if not exists roomchange_new_room_idx on public.room_change_requests(new_room_id);
create index if not exists ratings_property_created_idx on public.ratings(property_id,created_at desc);
create index if not exists ratings_tenant_created_idx on public.ratings(tenant_id,created_at desc);
create index if not exists membership_requests_property_idx on public.membership_requests(property_id,requested_at desc);
create index if not exists membership_requests_reviewer_idx on public.membership_requests(reviewed_by) where reviewed_by is not null;

-- Public property photos; only the owning property owner may mutate objects.
drop policy if exists property_photos_public_read on storage.objects;
create policy property_photos_public_read on storage.objects for select to public using(bucket_id='property-photos');
drop policy if exists property_photos_owner_insert on storage.objects;
create policy property_photos_owner_insert on storage.objects for insert to authenticated with check(
  bucket_id='property-photos' and (
    public.is_hostelset_admin()
    or (
      owner_id=auth.uid()::text
      and (
        exists(select 1 from public.properties p where p.owner_id=auth.uid() and p.id::text=(storage.foldername(name))[1])
        or ((storage.foldername(name))[1]='temp-property' and exists(select 1 from public.users u where u.id=auth.uid() and u.role='owner' and u.is_active))
      )
    )
  )
);
drop policy if exists property_photos_owner_update on storage.objects;
create policy property_photos_owner_update on storage.objects for update to authenticated using(bucket_id='property-photos' and (public.is_hostelset_admin() or owner_id=auth.uid()::text)) with check(bucket_id='property-photos' and (public.is_hostelset_admin() or owner_id=auth.uid()::text));
drop policy if exists property_photos_owner_delete on storage.objects;
create policy property_photos_owner_delete on storage.objects for delete to authenticated using(bucket_id='property-photos' and (public.is_hostelset_admin() or owner_id=auth.uid()::text));

-- Rent proof upload support; tenant documents remain private.
drop policy if exists tenant_documents_tenant_insert on storage.objects;
create policy tenant_documents_tenant_insert on storage.objects for insert to authenticated with check(bucket_id='tenant-documents' and owner_id=auth.uid()::text and name like 'rent\_%' escape '\' and exists(select 1 from public.tenants t where t.user_id=auth.uid()));
drop policy if exists tenant_documents_payment_participants_read on storage.objects;
create policy tenant_documents_payment_participants_read on storage.objects for select to authenticated using(
  bucket_id='tenant-documents' and (
    public.is_hostelset_admin()
    or exists(
      select 1 from public.payment_history ph join public.tenants t on t.id=ph.tenant_id join public.properties p on p.id=t.property_id
      where ph.payment_screenshot like '%'||storage.objects.name and (t.user_id=auth.uid() or p.owner_id=auth.uid())
    )
  )
);

-- PostgREST privileges are broad only at the SQL privilege layer; RLS above is
-- the mandatory row-level authorization boundary.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.properties,public.rooms,public.owner_settings to anon;
grant select,insert,update,delete on public.users,public.properties,public.rooms,public.tenants,public.payment_history,public.applications,public.pre_bookings,public.complaints,public.check_out_requests,public.room_change_requests,public.notices,public.owner_settings,public.ratings,public.membership_requests to authenticated;
grant all on all tables in schema public to service_role;

-- One consistent updated_at trigger for mutable core records. Trigger names are
-- deterministic and replaced before creation, preventing duplicates.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
revoke all on function public.set_updated_at() from public,anon,authenticated;
do $$ declare n text; mutable text[]:=array['users','properties','rooms','tenants','payment_history','applications','pre_bookings','complaints','check_out_requests','room_change_requests','notices','owner_settings'];
begin
  foreach n in array mutable loop
    execute format('drop trigger if exists set_updated_at on public.%I',n);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',n);
  end loop;
end $$;

revoke all on function public.refresh_room_public_availability(uuid) from public,anon,authenticated;
revoke all on function public.sync_room_public_availability() from public,anon,authenticated;

-- Realtime is limited to tables that currently have active subscriptions.
do $$ declare n text; keep text[]:=array['users','properties','rooms','tenants','payment_history','applications','pre_bookings','complaints','check_out_requests','room_change_requests','notices','owner_settings','membership_requests'];
begin
  for n in select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' loop
    if not (n=any(keep)) then execute format('alter publication supabase_realtime drop table public.%I',n); end if;
  end loop;
  foreach n in array keep loop
    if to_regclass(format('public.%I',n)) is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n) then execute format('alter publication supabase_realtime add table public.%I',n); end if;
  end loop;
end $$;
