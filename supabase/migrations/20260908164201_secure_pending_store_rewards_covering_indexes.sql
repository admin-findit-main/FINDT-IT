-- Cover the six composite foreign keys added for store-consistent loyalty data.

create index if not exists store_customer_claims_relationship_store_idx
  on public.store_customer_claims (store_customer_id, store_id);

create index if not exists store_customer_claims_claimed_target_store_idx
  on public.store_customer_claims (claimed_store_customer_id, store_id)
  where claimed_store_customer_id is not null;

create index if not exists store_purchases_relationship_store_idx
  on public.store_purchases (store_customer_id, store_id);

create index if not exists store_purchases_pending_origin_store_idx
  on public.store_purchases (pending_store_customer_id, store_id)
  where pending_store_customer_id is not null;

create index if not exists reward_ledger_purchase_store_idx
  on public.reward_ledger (store_purchase_id, store_id)
  where store_purchase_id is not null;

create index if not exists store_customers_merge_target_store_idx
  on public.store_customers (merged_into_store_customer_id, store_id)
  where merged_into_store_customer_id is not null;
