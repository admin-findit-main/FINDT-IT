-- FINDIT verified visits, usage billing ledger, rewards, rotating Hub check-in.
-- Additive. Service role writes sensitive rows. No live payment collection.

create table if not exists public.findit_billing_config (
  id smallint primary key default 1 check (id = 1),
  base_monthly_cents integer not null default 1899,
  visit_cents integer not null default 25,
  payg_max_visits integer not null default 320,
  payg_max_cents integer not null default 9900,
  growth_min_visits integer not null default 321,
  growth_max_visits integer not null default 1000,
  growth_monthly_cents integer not null default 12900,
  business_min_visits integer not null default 1001,
  business_max_visits integer not null default 2500,
  business_monthly_cents integer not null default 19900,
  high_volume_min_visits integer not null default 2501,
  high_volume_max_visits integer not null default 5000,
  high_volume_monthly_cents integer not null default 29900,
  enterprise_min_visits integer not null default 5001,
  trial_days integer not null default 30,
  employee_pool_percent numeric(5,2) not null default 15,
  employee_pool_max_cents integer,
  employee_pool_enabled boolean not null default true,
  shopper_points_per_visit integer not null default 5,
  employee_points_per_visit integer not null default 10,
  shopper_max_rewarded_checkins_per_day integer not null default 3,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.findit_billing_config (id) values (1)
on conflict (id) do nothing;

comment on table public.findit_billing_config is
  'Singleton FINDIT usage pricing and reward knobs. Live collection stays off until launch.';

create table if not exists public.store_checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  device_id uuid not null references public.store_devices(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists store_checkin_tokens_store_exp_idx
  on public.store_checkin_tokens (store_id, expires_at desc);

create index if not exists store_checkin_tokens_device_idx
  on public.store_checkin_tokens (device_id, issued_at desc);

comment on table public.store_checkin_tokens is
  'Short-lived Hub check-in QR secrets. Only the HMAC hash is stored.';

create table if not exists public.store_selections (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  request_id uuid not null references public.customer_requests(id) on delete cascade,
  store_response_id uuid references public.store_responses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shopper_id, request_id, store_id)
);

create index if not exists store_selections_store_idx
  on public.store_selections (store_id, created_at desc);

create index if not exists store_selections_request_idx
  on public.store_selections (request_id);

comment on table public.store_selections is
  'Shopper chose this store for a Find. Not billable by itself.';

create table if not exists public.store_billing_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  unique (store_id, period_start)
);

create index if not exists store_billing_periods_store_idx
  on public.store_billing_periods (store_id, period_start desc);

create table if not exists public.verified_visits (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  request_id uuid not null references public.customer_requests(id) on delete cascade,
  store_selection_id uuid references public.store_selections(id) on delete set null,
  store_response_id uuid references public.store_responses(id) on delete set null,
  employee_user_id uuid references public.profiles(id) on delete set null,
  shift_employee_id uuid references public.store_shift_employees(id) on delete set null,
  hub_device_id uuid references public.store_devices(id) on delete set null,
  checkin_token_id uuid references public.store_checkin_tokens(id) on delete set null,
  verification_method text not null default 'hub_qr',
  verified_at timestamptz not null default now(),
  status text not null default 'verified'
    check (status in ('pending', 'verified', 'rejected', 'fraud_review', 'reversed')),
  billable boolean not null default false,
  rewardable boolean not null default false,
  fraud_status text not null default 'clean'
    check (fraud_status in ('clean', 'flagged', 'review', 'blocked')),
  reject_reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists verified_visits_shopper_request_store_uidx
  on public.verified_visits (shopper_id, request_id, store_id)
  where status in ('pending', 'verified', 'fraud_review');

create unique index if not exists verified_visits_token_uidx
  on public.verified_visits (checkin_token_id)
  where checkin_token_id is not null;

create index if not exists verified_visits_store_verified_idx
  on public.verified_visits (store_id, verified_at desc);

create index if not exists verified_visits_shopper_idx
  on public.verified_visits (shopper_id, verified_at desc);

comment on table public.verified_visits is
  'Billable FINDIT visit after Hub QR check-in. Frontend cannot set verified.';

create table if not exists public.store_usage_statements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  billing_period_id uuid not null references public.store_billing_periods(id) on delete cascade,
  status text not null default 'draft'
    check (status in (
      'draft', 'open', 'review', 'finalized',
      'payment_pending', 'paid', 'failed', 'disputed', 'void'
    )),
  visit_count integer not null default 0,
  estimated_cents integer not null default 0,
  trial boolean not null default true,
  charged_cents integer not null default 0,
  tier_id text,
  payment_provider text not null default 'none',
  provider_customer_id text,
  provider_subscription_id text,
  provider_invoice_id text,
  provider_payment_id text,
  payment_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_period_id)
);

create index if not exists store_usage_statements_store_idx
  on public.store_usage_statements (store_id, created_at desc);

create table if not exists public.store_billing_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  verified_visit_id uuid references public.verified_visits(id) on delete set null,
  billing_period_id uuid not null references public.store_billing_periods(id) on delete cascade,
  statement_id uuid references public.store_usage_statements(id) on delete set null,
  event_type text not null
    check (event_type in (
      'base_subscription', 'verified_visit_usage', 'pricing_adjustment',
      'credit', 'manual_adjustment', 'reversal'
    )),
  amount_cents integer not null default 0,
  description text not null,
  status text not null default 'recorded'
    check (status in ('recorded', 'void', 'disputed')),
  created_at timestamptz not null default now()
);

create index if not exists store_billing_ledger_store_idx
  on public.store_billing_ledger (store_id, created_at desc);

create index if not exists store_billing_ledger_period_idx
  on public.store_billing_ledger (billing_period_id, created_at);

comment on table public.store_billing_ledger is
  'Append-only explanation of FINDIT store charges. Totals are derived, not a mutable balance.';

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  verified_visit_id uuid references public.verified_visits(id) on delete set null,
  reward_type text not null,
  audience text not null check (audience in ('shopper', 'employee')),
  points integer not null,
  estimated_value_cents integer,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'reversed', 'expired', 'redeemed')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists reward_ledger_user_idx
  on public.reward_ledger (user_id, created_at desc);

create index if not exists reward_ledger_store_idx
  on public.reward_ledger (store_id, created_at desc)
  where store_id is not null;

create table if not exists public.billing_disputes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  verified_visit_id uuid references public.verified_visits(id) on delete set null,
  ledger_id uuid references public.store_billing_ledger(id) on delete set null,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'review', 'accepted', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_disputes_store_idx
  on public.billing_disputes (store_id, created_at desc);

create table if not exists public.checkin_attempts (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  token_hash text,
  result text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists checkin_attempts_shopper_idx
  on public.checkin_attempts (shopper_id, created_at desc)
  where shopper_id is not null;

drop trigger if exists trg_store_usage_statements_updated on public.store_usage_statements;
create trigger trg_store_usage_statements_updated
  before update on public.store_usage_statements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_billing_disputes_updated on public.billing_disputes;
create trigger trg_billing_disputes_updated
  before update on public.billing_disputes
  for each row execute function public.set_updated_at();

alter table public.findit_billing_config enable row level security;
alter table public.findit_billing_config force row level security;
alter table public.store_checkin_tokens enable row level security;
alter table public.store_checkin_tokens force row level security;
alter table public.store_selections enable row level security;
alter table public.store_selections force row level security;
alter table public.store_billing_periods enable row level security;
alter table public.store_billing_periods force row level security;
alter table public.verified_visits enable row level security;
alter table public.verified_visits force row level security;
alter table public.store_usage_statements enable row level security;
alter table public.store_usage_statements force row level security;
alter table public.store_billing_ledger enable row level security;
alter table public.store_billing_ledger force row level security;
alter table public.reward_ledger enable row level security;
alter table public.reward_ledger force row level security;
alter table public.billing_disputes enable row level security;
alter table public.billing_disputes force row level security;
alter table public.checkin_attempts enable row level security;
alter table public.checkin_attempts force row level security;

revoke all on table public.findit_billing_config from anon, authenticated;
revoke all on table public.store_checkin_tokens from anon, authenticated;
revoke all on table public.store_selections from anon, authenticated;
revoke all on table public.store_billing_periods from anon, authenticated;
revoke all on table public.verified_visits from anon, authenticated;
revoke all on table public.store_usage_statements from anon, authenticated;
revoke all on table public.store_billing_ledger from anon, authenticated;
revoke all on table public.reward_ledger from anon, authenticated;
revoke all on table public.billing_disputes from anon, authenticated;
revoke all on table public.checkin_attempts from anon, authenticated;

-- Shoppers may read their own selections and rewards. Owners read store billing
-- rows without shopper contact fields being granted as a Data API dump of PII
-- beyond ids the server already filters in actions.
grant select on public.store_selections to authenticated;
grant select on public.reward_ledger to authenticated;
grant select on public.store_usage_statements to authenticated;
grant select on public.store_billing_ledger to authenticated;
grant select on public.verified_visits to authenticated;
grant select on public.billing_disputes to authenticated;
grant select on public.findit_billing_config to authenticated;
grant select on public.store_billing_periods to authenticated;

drop policy if exists findit_billing_config_read on public.findit_billing_config;
create policy findit_billing_config_read on public.findit_billing_config
  for select to authenticated
  using (public.is_admin());

create unique index if not exists reward_ledger_visit_audience_uidx
  on public.reward_ledger (verified_visit_id, audience)
  where verified_visit_id is not null;

create unique index if not exists billing_disputes_open_visit_uidx
  on public.billing_disputes (store_id, verified_visit_id)
  where verified_visit_id is not null and status in ('open', 'review');

drop policy if exists store_selections_read_own on public.store_selections;
create policy store_selections_read_own on public.store_selections
  for select to authenticated
  using (
    shopper_id = (select auth.uid())
    or public.can_manage_store(store_id)
    or public.is_admin()
  );

drop policy if exists verified_visits_read on public.verified_visits;
create policy verified_visits_read on public.verified_visits
  for select to authenticated
  using (
    shopper_id = (select auth.uid())
    or public.can_manage_store(store_id)
    or public.is_admin()
  );

drop policy if exists store_billing_periods_read on public.store_billing_periods;
create policy store_billing_periods_read on public.store_billing_periods
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_admin());

drop policy if exists store_usage_statements_read on public.store_usage_statements;
create policy store_usage_statements_read on public.store_usage_statements
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_admin());

drop policy if exists store_billing_ledger_read on public.store_billing_ledger;
create policy store_billing_ledger_read on public.store_billing_ledger
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_admin());

drop policy if exists reward_ledger_read on public.reward_ledger;
create policy reward_ledger_read on public.reward_ledger
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (store_id is not null and public.can_manage_store(store_id))
    or public.is_admin()
  );

drop policy if exists billing_disputes_read on public.billing_disputes;
create policy billing_disputes_read on public.billing_disputes
  for select to authenticated
  using (public.can_manage_store(store_id) or public.is_admin());
