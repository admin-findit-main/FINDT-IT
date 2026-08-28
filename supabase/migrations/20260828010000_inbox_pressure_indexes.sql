-- Hub inbox: unanswered rows for one store, newest first.
-- Store replies: look up by store + request in one pass.

create index if not exists request_targets_store_unanswered_idx
  on public.request_targets (store_id, created_at desc)
  where responded_at is null;

create index if not exists request_targets_store_created_idx
  on public.request_targets (store_id, created_at desc);

create index if not exists store_responses_store_request_idx
  on public.store_responses (store_id, request_id);
