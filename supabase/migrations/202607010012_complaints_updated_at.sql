-- Reconcile legacy complaints tables before attaching the shared timestamp trigger.
alter table public.complaints
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.complaints;
create trigger set_updated_at
before update on public.complaints
for each row execute function public.set_updated_at();

