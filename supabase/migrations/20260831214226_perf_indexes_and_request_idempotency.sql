-- Hot-path list indexes, store geo filter, and Find submit idempotency.
-- Does not drop columns or rewrite product routing.

create index if not exists customer_requests_customer_status_created_idx
  on public.customer_requests (customer_id, status, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists store_members_user_status_idx
  on public.store_members (user_id, status);

create index if not exists stores_active_geo_idx
  on public.stores (latitude, longitude)
  where is_active = true
    and is_suspended = false
    and latitude is not null
    and longitude is not null;

create index if not exists store_responses_store_created_idx
  on public.store_responses (store_id, created_at desc);

create index if not exists billing_events_profile_idx
  on public.billing_events (profile_id)
  where profile_id is not null;

alter table public.customer_requests
  add column if not exists client_request_key text;

create unique index if not exists customer_requests_client_key_uidx
  on public.customer_requests (customer_id, client_request_key)
  where client_request_key is not null;

comment on column public.customer_requests.client_request_key is
  'Browser-generated key so a double submit creates one Find.';
