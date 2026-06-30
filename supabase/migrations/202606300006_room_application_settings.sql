-- Owner-controlled room audience and application deposit.

alter table public.rooms
  add column if not exists room_audience text not null default 'coliving',
  add column if not exists deposit_amount numeric(12,2) not null default 3000;

alter table public.rooms alter column deposit_amount set default 3000;
update public.rooms set deposit_amount = 3000 where deposit_amount is distinct from 3000;

alter table public.rooms drop constraint if exists rooms_audience_valid;
alter table public.rooms add constraint rooms_audience_valid
  check (room_audience in ('boys', 'girls', 'coliving'));
alter table public.rooms drop constraint if exists rooms_deposit_amount_valid;
alter table public.rooms add constraint rooms_deposit_amount_valid
  check (deposit_amount = 3000);

-- Give existing rooms a sensible label from their property type.
update public.rooms room
set room_audience = case
  when property.property_type = 'boys' then 'boys'
  when property.property_type = 'girls' then 'girls'
  else 'coliving'
end
from public.properties property
where property.id = room.property_id
  and room.room_audience = 'coliving';

create index if not exists rooms_property_audience_status_idx
  on public.rooms(property_id, room_audience, status);
