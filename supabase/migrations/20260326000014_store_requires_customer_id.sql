-- Age-restricted store applications (tobacco / vape).
-- Stores already have public.stores.age_restricted; this is the join-form answer
-- copied onto the store when an application is approved.

alter table public.store_applications
  add column if not exists requires_customer_id boolean not null default false;

comment on column public.store_applications.requires_customer_id is
  'Owner said customers must show a government ID. Copied to stores.age_restricted on approval.';
