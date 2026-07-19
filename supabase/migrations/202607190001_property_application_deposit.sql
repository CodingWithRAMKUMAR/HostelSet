-- Add a separate property-wide application deposit.
-- Pre-booking fee remains independent and unchanged.

alter table public.owner_settings
  add column if not exists application_deposit numeric(12,2);

alter table public.rooms
  drop constraint if exists rooms_deposit_amount_valid;

update public.owner_settings as settings
set application_deposit = coalesce(
  (
    select max(room.deposit_amount)
    from public.rooms as room
    where room.property_id = settings.property_id
      and room.deposit_amount > 0
  ),
  3000
)
where settings.application_deposit is null
   or settings.application_deposit <= 0;

alter table public.owner_settings
  alter column application_deposit set default 3000;

alter table public.owner_settings
  alter column application_deposit set not null;

alter table public.owner_settings
  drop constraint if exists owner_settings_application_deposit_positive;

alter table public.owner_settings
  add constraint owner_settings_application_deposit_positive
  check (application_deposit > 0);

alter table public.rooms
  drop constraint if exists rooms_deposit_amount_positive;

alter table public.rooms
  add constraint rooms_deposit_amount_positive
  check (deposit_amount > 0);

update public.rooms as room
set deposit_amount = settings.application_deposit
from public.owner_settings as settings
where settings.property_id = room.property_id
  and room.deposit_amount is distinct from settings.application_deposit;

create or replace function public.sync_property_application_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.application_deposit is distinct from old.application_deposit then
    update public.rooms
    set deposit_amount = new.application_deposit
    where property_id = new.property_id
      and deposit_amount is distinct from new.application_deposit;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_property_application_deposit_trigger
  on public.owner_settings;

create trigger sync_property_application_deposit_trigger
after insert or update of application_deposit
on public.owner_settings
for each row
execute function public.sync_property_application_deposit();

revoke all on function public.sync_property_application_deposit() from public;
grant execute on function public.sync_property_application_deposit() to authenticated;
grant execute on function public.sync_property_application_deposit() to service_role;
