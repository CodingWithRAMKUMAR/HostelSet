-- Reconcile legacy approval-path tables before using the shared timestamp trigger.
alter table public.applications
  add column if not exists updated_at timestamptz not null default now();

alter table public.payment_history
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.applications;
create trigger set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.payment_history;
create trigger set_updated_at
before update on public.payment_history
for each row execute function public.set_updated_at();

