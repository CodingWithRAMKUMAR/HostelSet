-- Reconcile workflow tables created by legacy/manual schemas with the current
-- versioned baseline. Existing columns and workflow data are preserved.

do $$
declare
  table_name text;
  workflow_tables constant text[] := array[
    'room_change_requests',
    'check_out_requests',
    'complaints',
    'applications',
    'pre_bookings',
    'payment_history',
    'tenants',
    'rooms',
    'notices',
    'owner_settings'
  ];
begin
  foreach table_name in array workflow_tables loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      table_name
    );

    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;
