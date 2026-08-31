-- FastSpring billing. subscriptions remains the store source of truth.
-- FINDIT stores FastSpring IDs and statuses only — never raw bank/card data.

alter table public.subscriptions
  add column if not exists plan_id text not null default 'trial',
  add column if not exists billing_method text not null default 'none',
  add column if not exists payment_status text not null default 'none',
  add column if not exists access_override text not null default 'none',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_started_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists next_payment_at timestamptz,
  add column if not exists last_order_id text,
  add column if not exists last_invoice_url text;

update public.subscriptions
set
  plan_id = case when plan in ('starter', 'pro', 'business') then 'business' else 'trial' end,
  provider = case when provider = 'stripe' then 'fastspring' else provider end
where plan_id = 'trial' or provider = 'stripe';

alter table public.subscriptions
  alter column provider set default 'fastspring';

create index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists subscriptions_provider_customer_idx
  on public.subscriptions (provider_customer_id)
  where provider_customer_id is not null;

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

comment on table public.subscriptions is
  'Store billing source of truth. FastSpring IDs and statuses only; no raw payment credentials.';

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_insert_owner on public.subscriptions
  for insert
  to authenticated
  with check (public.store_role(store_id) = 'owner' or public.is_admin());

-- Owners read their row. Writes of billing fields go through the service role.
create policy subscriptions_update_admin on public.subscriptions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'fastspring',
  provider_customer_id text,
  provider_subscription_id text,
  plan_id text not null default 'free',
  status text not null default 'inactive',
  billing_method text not null default 'none',
  payment_status text not null default 'none',
  access_override text not null default 'none',
  subscription_started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_payment_at timestamptz,
  next_payment_at timestamptz,
  last_order_id text,
  last_invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create index if not exists customer_subscriptions_provider_sub_idx
  on public.customer_subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

comment on table public.customer_subscriptions is
  'Shopper FINDIT+ billing. Separate from store subscriptions. No raw payment credentials.';

drop trigger if exists trg_customer_subscriptions_updated on public.customer_subscriptions;
create trigger trg_customer_subscriptions_updated
  before update on public.customer_subscriptions
  for each row execute function public.set_updated_at();

alter table public.customer_subscriptions enable row level security;
alter table public.customer_subscriptions force row level security;

create policy customer_subscriptions_read_own on public.customer_subscriptions
  for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('store', 'customer')),
  store_id uuid references public.stores(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  provider text not null default 'fastspring',
  provider_order_id text,
  provider_subscription_id text,
  reference text,
  amount_cents integer,
  currency text not null default 'USD',
  payment_method text,
  payment_status text not null,
  invoice_url text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint billing_invoices_subject check (
    (audience = 'store' and store_id is not null) or
    (audience = 'customer' and profile_id is not null)
  )
);

create unique index if not exists billing_invoices_provider_order_uidx
  on public.billing_invoices (provider, provider_order_id);

create index if not exists billing_invoices_store_idx
  on public.billing_invoices (store_id, occurred_at desc)
  where store_id is not null;

create index if not exists billing_invoices_profile_idx
  on public.billing_invoices (profile_id, occurred_at desc)
  where profile_id is not null;

comment on table public.billing_invoices is
  'Safe payment history: amounts, status, invoice URLs. Never bank or card numbers.';

alter table public.billing_invoices enable row level security;
alter table public.billing_invoices force row level security;

create policy billing_invoices_read_own on public.billing_invoices
  for select
  to authenticated
  using (
    public.is_admin()
    or (store_id is not null and public.can_manage_store(store_id))
    or (profile_id is not null and profile_id = (select auth.uid()))
  );

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fastspring',
  event_id text not null,
  event_type text not null,
  live boolean not null default false,
  audience text,
  store_id uuid references public.stores(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  provider_account_id text,
  provider_subscription_id text,
  provider_order_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists billing_events_type_idx
  on public.billing_events (event_type, processed_at desc);

create index if not exists billing_events_store_idx
  on public.billing_events (store_id, processed_at desc)
  where store_id is not null;

comment on table public.billing_events is
  'FastSpring webhook idempotency log. Payloads are redacted before insert.';

alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

create table if not exists public.billing_settings (
  id integer primary key default 1 check (id = 1),
  billing_required boolean not null default false,
  shopper_billing_required boolean not null default false,
  live_billing_approved boolean not null default false,
  live_billing_approved_at timestamptz,
  live_billing_approved_by uuid references public.profiles(id) on delete set null,
  allow_past_due_access boolean not null default true,
  allow_failed_payment_access boolean not null default true,
  allow_pending_payment_access boolean not null default true,
  launch_checklist jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.billing_settings is
  'Pilot switch and launch checklist. billing_required=false means stores keep working unpaid.';

drop trigger if exists trg_billing_settings_updated on public.billing_settings;
create trigger trg_billing_settings_updated
  before update on public.billing_settings
  for each row execute function public.set_updated_at();

alter table public.billing_settings enable row level security;
alter table public.billing_settings force row level security;

create policy billing_settings_admin_read on public.billing_settings
  for select
  to authenticated
  using (public.is_admin());

revoke all on public.billing_events from public, anon, authenticated;
revoke all on public.billing_settings from public, anon, authenticated;
grant all on public.billing_events to service_role;
grant all on public.billing_settings to service_role;
grant select on public.billing_settings to authenticated;

grant select, insert, update, delete on public.customer_subscriptions to authenticated, service_role;
grant select, insert, update, delete on public.billing_invoices to authenticated, service_role;

-- Authenticated DML is still blocked by RLS except admin/owner reads.
revoke insert, update, delete on public.customer_subscriptions from authenticated;
revoke insert, update, delete on public.billing_invoices from authenticated;
revoke insert, update, delete on public.billing_settings from authenticated;

create or replace function public.protect_subscription_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.provider := 'fastspring';
    new.plan := 'free';
    new.plan_id := 'trial';
    new.status := 'trial';
    new.provider_customer_id := null;
    new.provider_subscription_id := null;
    new.payment_status := 'none';
    new.access_override := 'none';
    new.billing_method := 'none';
    return new;
  end if;
  new.provider := old.provider;
  new.provider_customer_id := old.provider_customer_id;
  new.provider_subscription_id := old.provider_subscription_id;
  new.plan := old.plan;
  new.plan_id := old.plan_id;
  new.status := old.status;
  new.billing_method := old.billing_method;
  new.payment_status := old.payment_status;
  new.access_override := old.access_override;
  new.trial_started_at := old.trial_started_at;
  new.trial_ends_at := old.trial_ends_at;
  new.subscription_started_at := old.subscription_started_at;
  new.current_period_start := old.current_period_start;
  new.current_period_end := old.current_period_end;
  new.cancel_at_period_end := old.cancel_at_period_end;
  new.canceled_at := old.canceled_at;
  new.last_payment_at := old.last_payment_at;
  new.next_payment_at := old.next_payment_at;
  new.last_order_id := old.last_order_id;
  new.last_invoice_url := old.last_invoice_url;
  return new;
end;
$$;

drop trigger if exists trg_protect_subscription_billing on public.subscriptions;
create trigger trg_protect_subscription_billing
  before insert or update on public.subscriptions
  for each row execute function public.protect_subscription_billing_fields();

revoke execute on function public.protect_subscription_billing_fields() from public, anon, authenticated;
