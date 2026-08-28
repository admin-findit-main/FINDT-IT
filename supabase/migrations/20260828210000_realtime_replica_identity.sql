-- Filtered Realtime postgres_changes on non-PK columns need replica identity FULL
-- so INSERT/UPDATE events with store_id / request_id filters actually deliver.

alter table public.request_targets replica identity full;
alter table public.store_responses replica identity full;
alter table public.customer_requests replica identity full;
alter table public.notifications replica identity full;
