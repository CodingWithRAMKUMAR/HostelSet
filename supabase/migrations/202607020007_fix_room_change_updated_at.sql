-- Bring legacy room_change_requests tables in line with the versioned baseline.
-- Approval/rejection RPCs and the shared timestamp trigger both require this
-- column; no room-change business behavior is changed here.

alter table public.room_change_requests
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.room_change_requests;
create trigger set_updated_at
before update on public.room_change_requests
for each row execute function public.set_updated_at();
