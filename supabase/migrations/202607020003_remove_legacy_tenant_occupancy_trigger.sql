-- Remove a legacy remote-only trigger. Atomic tenant creation/approval RPCs
-- already update room occupancy in the same transaction.
drop trigger if exists tenant_occupancy_trigger on public.tenants;
drop function if exists public.auto_recalc_room_occupancy();

