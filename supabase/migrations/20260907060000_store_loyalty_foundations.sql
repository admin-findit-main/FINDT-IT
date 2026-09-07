-- Phase 1 of store loyalty: identity, the store-customer relationship, and an
-- auditable points trail. Additive only -- no existing column, table, policy or
-- index is altered or dropped.
--
-- Two existing systems are extended rather than duplicated:
--
--   * `profiles.phone_e164` stays the one canonical phone. It already has an
--     E.164 CHECK, a unique partial index, and the `protect_profile_phone`
--     trigger that blocks `authenticated` from changing it. Adding a second
--     phone column would mean two sources of truth for the same fact.
--   * `reward_ledger` stays the one points ledger. It is append-only and
--     already carries a UNIQUE (verified_visit_id, audience) for idempotency.
--
-- The catch with reusing the ledger is that FINDIT Points and store loyalty
-- points are different currencies with different funders, and
-- getShopperPointsAction sums the whole table for a user. Hence `program`,
-- defaulting to 'findit' so every existing row keeps its present meaning.

-- ---------------------------------------------------------------------------
-- 1. Phone verification state
-- ---------------------------------------------------------------------------

-- Verification is tracked separately from the number itself so a phone can be
-- collected now and verified once the SMS path is configured, without
-- backfilling or rebuilding anything. PHONE_OTP_ENABLED is currently false.
alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;

comment on column public.profiles.phone_verified is
  'True only after the shopper proved control of phone_e164. Never set from a self-reported number: loyalty records are claimed on this flag.';

-- Backfill only where Supabase Auth already proved the number. Anything else
-- stays false rather than being assumed verified.
update public.profiles p
set phone_verified = true,
    phone_verified_at = u.phone_confirmed_at
from auth.users u
where u.id = p.id
  and u.phone_confirmed_at is not null
  and p.phone_e164 is not null
  and p.phone_verified = false;

-- Separate from the notify_* request flags so promotions can be silenced
-- without also silencing "your request was answered".
alter table public.profiles
  add column if not exists notify_store_promotions boolean not null default true;

comment on column public.profiles.notify_store_promotions is
  'Global opt-out for store promotions. Never sufficient on its own: a campaign audience is always intersected with an existing store_customers relationship.';

-- ---------------------------------------------------------------------------
-- 2. The store-customer relationship
-- ---------------------------------------------------------------------------

create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Null while the record is pending: a purchase can be recorded for someone
  -- who has no FINDIT account yet, and is claimed later once they verify the
  -- matching phone. The phone itself lives in store_customer_claims so this
  -- table carries no contact information.
  customer_id uuid references public.profiles(id) on delete cascade,
  points_balance integer not null default 0,
  lifetime_points integer not null default 0,
  confirmed_purchases integer not null default 0,
  marketing_opt_in boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_customers_points_non_negative
    check (points_balance >= 0 and lifetime_points >= 0),
  constraint store_customers_purchases_non_negative
    check (confirmed_purchases >= 0),
  -- lifetime_points only ever grows, so it can never trail the balance.
  constraint store_customers_lifetime_gte_balance
    check (lifetime_points >= points_balance)
);

-- One relationship per store per shopper. Partial, because pending rows share
-- a null customer_id and nulls are not equal under a plain unique constraint.
create unique index if not exists store_customers_store_customer_uidx
  on public.store_customers (store_id, customer_id)
  where customer_id is not null;

-- Drives the owner-side Customers list, which is ordered by recency and paged.
create index if not exists store_customers_store_activity_idx
  on public.store_customers (store_id, last_seen_at desc);

-- Drives "my rewards across stores" for a shopper.
create index if not exists store_customers_customer_idx
  on public.store_customers (customer_id, last_seen_at desc)
  where customer_id is not null;

drop trigger if exists trg_store_customers_updated on public.store_customers;
create trigger trg_store_customers_updated
  before update on public.store_customers
  for each row execute function public.set_updated_at();

comment on table public.store_customers is
  'Per-store loyalty relationship for a global FINDIT shopper. One row per (store, customer); a store can never see another store''s rows.';

-- ---------------------------------------------------------------------------
-- 3. Pending claims (phone numbers live here, not on the relationship)
-- ---------------------------------------------------------------------------

-- Isolated so that granting a store read access to its customer list never
-- also grants it phone numbers. Service-role only: no policies, so PostgREST
-- exposes nothing even to a store owner.
create table if not exists public.store_customer_claims (
  id uuid primary key default gen_random_uuid(),
  store_customer_id uuid not null unique
    references public.store_customers(id) on delete cascade,
  phone_e164 text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references public.profiles(id) on delete set null,
  constraint store_customer_claims_phone_e164_format
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

-- A phone can hold at most one unclaimed pending record per store, so repeat
-- purchases before registration accumulate on one relationship.
create unique index if not exists store_customer_claims_open_phone_uidx
  on public.store_customer_claims (phone_e164, store_customer_id)
  where claimed_at is null;

create index if not exists store_customer_claims_phone_idx
  on public.store_customer_claims (phone_e164)
  where claimed_at is null;

alter table public.store_customer_claims enable row level security;
revoke all on public.store_customer_claims from anon, authenticated;

comment on table public.store_customer_claims is
  'Phone numbers attached to pending (unregistered) store_customers rows. Service-role only. A claim is honoured only against a phone_verified profile -- never on a self-reported number.';

-- ---------------------------------------------------------------------------
-- 4. Employee-confirmed purchases
-- ---------------------------------------------------------------------------

create table if not exists public.store_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_customer_id uuid not null
    references public.store_customers(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  -- Who confirmed it. Points at the profile rather than at store_members so
  -- that removing someone from the team cannot rewrite who confirmed a past
  -- purchase; ON DELETE SET NULL for the same reason -- history outlives the
  -- account. Null also covers a Hub shift employee with no auth user.
  employee_user_id uuid references public.profiles(id) on delete set null,
  request_id uuid references public.customer_requests(id) on delete set null,
  source text not null,
  points_awarded integer not null default 0,
  status text not null default 'confirmed',
  -- Supplied by the server, not the browser. Makes a double-tapped Confirm
  -- land on the same row instead of paying out twice.
  idempotency_key text not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint store_purchases_source_check
    check (source in ('request', 'phone_lookup')),
  constraint store_purchases_status_check
    check (status in ('confirmed', 'reversed')),
  constraint store_purchases_points_non_negative
    check (points_awarded >= 0)
);

create unique index if not exists store_purchases_idempotency_uidx
  on public.store_purchases (store_id, idempotency_key);

-- "The same request cannot be rewarded multiple times." Scoped to live rows so
-- a reversal can be corrected without dropping the guard.
create unique index if not exists store_purchases_request_uidx
  on public.store_purchases (request_id)
  where request_id is not null and status = 'confirmed';

create index if not exists store_purchases_store_confirmed_idx
  on public.store_purchases (store_id, confirmed_at desc);

create index if not exists store_purchases_customer_confirmed_idx
  on public.store_purchases (customer_id, confirmed_at desc)
  where customer_id is not null;

create index if not exists store_purchases_relationship_idx
  on public.store_purchases (store_customer_id, confirmed_at desc);

comment on table public.store_purchases is
  'One employee-confirmed in-store purchase. Deliberately not a verified_visit: verified_visits bill the store per visit, so recording purchases there would charge for every loyalty confirmation.';

-- ---------------------------------------------------------------------------
-- 5. Ledger: separate the two currencies
-- ---------------------------------------------------------------------------

alter table public.reward_ledger
  add column if not exists program text not null default 'findit',
  add column if not exists store_purchase_id uuid
    references public.store_purchases(id) on delete set null,
  add column if not exists employee_user_id uuid
    references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reward_ledger_program_check'
  ) then
    alter table public.reward_ledger
      add constraint reward_ledger_program_check
      check (program in ('findit', 'store_loyalty'));
  end if;
end
$$;

comment on column public.reward_ledger.program is
  'Which currency this row belongs to. FINDIT funds ''findit'' points; the store funds ''store_loyalty''. The two must never be summed together -- getShopperPointsAction filters on this.';

-- Same idempotency guarantee the verified-visit path already has.
create unique index if not exists reward_ledger_purchase_audience_uidx
  on public.reward_ledger (store_purchase_id, audience)
  where store_purchase_id is not null;

-- Balances are read from store_customers; this serves per-store history.
create index if not exists reward_ledger_program_store_idx
  on public.reward_ledger (program, store_id, created_at desc)
  where store_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Store-configurable rewards (deliberately minimal)
-- ---------------------------------------------------------------------------

create table if not exists public.store_reward_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  points_per_purchase integer not null default 10,
  reward_threshold_points integer not null default 100,
  reward_value_cents integer not null default 500,
  updated_at timestamptz not null default now(),
  constraint store_reward_settings_points_positive
    check (points_per_purchase > 0 and points_per_purchase <= 1000),
  constraint store_reward_settings_threshold_positive
    check (reward_threshold_points > 0),
  constraint store_reward_settings_value_positive
    check (reward_value_cents >= 0)
);

drop trigger if exists trg_store_reward_settings_updated on public.store_reward_settings;
create trigger trg_store_reward_settings_updated
  before update on public.store_reward_settings
  for each row execute function public.set_updated_at();

comment on table public.store_reward_settings is
  'Per-store loyalty configuration. Defaults to "100 points = $5" at 10 points per confirmed purchase, and starts disabled so no store awards points before its owner turns it on.';

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
-- Reads only. Every mutation of points, purchases and relationships goes
-- through server-side logic on the service-role client, so there is
-- deliberately no INSERT/UPDATE/DELETE policy for shoppers or employees:
-- "normal users cannot edit points directly".

alter table public.store_customers enable row level security;
alter table public.store_purchases enable row level security;
alter table public.store_reward_settings enable row level security;

drop policy if exists store_customers_read on public.store_customers;
create policy store_customers_read on public.store_customers
  for select to authenticated
  using (
    (customer_id is not null and customer_id = (select auth.uid()))
    or public.is_store_member(store_id)
    or public.is_admin()
  );

drop policy if exists store_purchases_read on public.store_purchases;
create policy store_purchases_read on public.store_purchases
  for select to authenticated
  using (
    (customer_id is not null and customer_id = (select auth.uid()))
    or public.is_store_member(store_id)
    or public.is_admin()
  );

drop policy if exists store_reward_settings_read on public.store_reward_settings;
create policy store_reward_settings_read on public.store_reward_settings
  for select to authenticated
  using (public.is_store_member(store_id) or public.is_admin());

-- Only owners/managers, never employees: can_manage_store excludes the
-- employee role, which is what keeps "employees cannot modify owner-only
-- settings" true at the database rather than only in the UI.
drop policy if exists store_reward_settings_write on public.store_reward_settings;
create policy store_reward_settings_write on public.store_reward_settings
  for update to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
