-- FINDIT initial schema
-- Roles, stores, requests, responses, notifications, subscriptions, reports

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type account_type as enum ('customer', 'business', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type store_member_role as enum ('owner', 'manager', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type store_member_status as enum ('invited', 'active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type response_type as enum ('in_stock', 'out_of_stock', 'can_order');
exception when duplicate_object then null; end $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  account_type account_type not null default 'customer',
  default_city text,
  default_state text,
  default_postal_code text,
  notify_in_stock boolean not null default true,
  notify_can_order boolean not null default true,
  notify_request_expired boolean not null default true,
  notify_new_request boolean not null default true,
  notify_demand_alerts boolean not null default true,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  website text,
  street_address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  latitude numeric,
  longitude numeric,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  is_suspended boolean not null default false,
  age_restricted boolean not null default false,
  subscription_plan text not null default 'free',
  subscription_status text not null default 'active',
  avg_response_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category text not null,
  unique (store_id, category)
);

create table if not exists public.store_service_areas (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  postal_code text not null,
  city text,
  state text,
  unique (store_id, postal_code)
);

create table if not exists public.store_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  unique (store_id, day_of_week)
);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role store_member_role not null default 'employee',
  status store_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role store_member_role not null default 'employee',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Customer requests
create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null,
  normalized_product_name text not null,
  description text,
  image_url text,
  category text,
  city text not null,
  state text not null default 'VA',
  postal_code text not null,
  radius_miles integer not null default 10,
  status text not null default 'active'
    check (status in ('draft', 'active', 'partially_answered', 'answered', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  stores_targeted integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_targets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.customer_requests(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_status text not null default 'sent',
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, store_id)
);

create table if not exists public.store_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.customer_requests(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  responded_by uuid not null references public.profiles(id) on delete restrict,
  response_type response_type not null,
  price numeric(10,2),
  quantity integer,
  note text,
  hold_minutes integer,
  estimated_available_at timestamptz,
  estimated_availability_label text,
  track_demand boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, store_id)
);

create table if not exists public.saved_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.customer_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, request_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  related_request_id uuid references public.customer_requests(id) on delete set null,
  related_store_id uuid references public.stores(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.customer_requests(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  reason text not null,
  description text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.prohibited_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.location_demand (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  postal_code text not null,
  product_name text,
  notify_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid,
  store_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_customer_requests_customer_id on public.customer_requests(customer_id);
create index if not exists idx_customer_requests_postal_code on public.customer_requests(postal_code);
create index if not exists idx_customer_requests_category on public.customer_requests(category);
create index if not exists idx_customer_requests_status on public.customer_requests(status);
create index if not exists idx_customer_requests_created_at on public.customer_requests(created_at desc);
create index if not exists idx_customer_requests_expires_at on public.customer_requests(expires_at);
create index if not exists idx_customer_requests_normalized on public.customer_requests(normalized_product_name);
create index if not exists idx_request_targets_store_id on public.request_targets(store_id);
create index if not exists idx_request_targets_request_id on public.request_targets(request_id);
create index if not exists idx_store_responses_request_id on public.store_responses(request_id);
create index if not exists idx_store_responses_store_id on public.store_responses(store_id);
create index if not exists idx_store_service_areas_postal_code on public.store_service_areas(postal_code);
create index if not exists idx_store_members_user_id on public.store_members(user_id);
create index if not exists idx_store_members_store_id on public.store_members(store_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;
create index if not exists idx_stores_owner_id on public.stores(owner_id);
create index if not exists idx_stores_postal_code on public.stores(postal_code);
create index if not exists idx_analytics_events_name on public.analytics_events(event_name, created_at desc);

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_requests_updated on public.customer_requests;
create trigger trg_customer_requests_updated before update on public.customer_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_store_responses_updated on public.store_responses;
create trigger trg_store_responses_updated before update on public.store_responses
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acct account_type;
begin
  acct := coalesce((new.raw_user_meta_data->>'account_type')::account_type, 'customer');
  insert into public.profiles (id, email, first_name, last_name, display_name, account_type, default_city, default_state, default_postal_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    acct,
    new.raw_user_meta_data->>'default_city',
    coalesce(new.raw_user_meta_data->>'default_state', 'VA'),
    new.raw_user_meta_data->>'default_postal_code'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Membership helpers (security definer to avoid RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'admin' and p.is_suspended = false
  );
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.store_role(p_store_id uuid)
returns store_member_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.store_members m
  where m.store_id = p_store_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  ) or public.is_admin();
$$;

-- Normalize product name
create or replace function public.normalize_product_name(input text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(input, '')), '\s+', ' ', 'g'));
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_service_areas enable row level security;
alter table public.store_hours enable row level security;
alter table public.store_members enable row level security;
alter table public.store_invites enable row level security;
alter table public.customer_requests enable row level security;
alter table public.request_targets enable row level security;
alter table public.store_responses enable row level security;
alter table public.saved_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.prohibited_terms enable row level security;
alter table public.location_demand enable row level security;
alter table public.analytics_events enable row level security;

-- Profiles policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- Stores: public can read active stores; members can read their stores
create policy "stores_public_read_active" on public.stores
  for select using (
    (is_active = true and is_suspended = false)
    or owner_id = auth.uid()
    or public.is_store_member(id)
    or public.is_admin()
  );

create policy "stores_insert_owner" on public.stores
  for insert with check (owner_id = auth.uid() or public.is_admin());

create policy "stores_update_manage" on public.stores
  for update using (public.can_manage_store(id) or owner_id = auth.uid());

-- Store categories / service areas / hours
create policy "store_categories_read" on public.store_categories
  for select using (
    exists (select 1 from public.stores s where s.id = store_id and (s.is_active or public.is_store_member(store_id) or public.is_admin()))
  );
create policy "store_categories_write" on public.store_categories
  for all using (public.can_manage_store(store_id));

create policy "store_service_areas_read" on public.store_service_areas
  for select using (public.is_store_member(store_id) or public.is_admin() or exists (select 1 from public.stores s where s.id = store_id and s.is_active));
create policy "store_service_areas_write" on public.store_service_areas
  for all using (public.can_manage_store(store_id));

create policy "store_hours_read" on public.store_hours
  for select using (true);
create policy "store_hours_write" on public.store_hours
  for all using (public.can_manage_store(store_id));

-- Members
create policy "store_members_read" on public.store_members
  for select using (user_id = auth.uid() or public.is_store_member(store_id) or public.is_admin());
create policy "store_members_write" on public.store_members
  for all using (public.can_manage_store(store_id) or public.is_admin());

-- Invites
create policy "store_invites_manage" on public.store_invites
  for all using (public.can_manage_store(store_id) or public.is_admin());
create policy "store_invites_read_by_email" on public.store_invites
  for select using (
    public.can_manage_store(store_id)
    or public.is_admin()
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- Customer requests
create policy "requests_select" on public.customer_requests
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.request_targets rt
      where rt.request_id = id and public.is_store_member(rt.store_id)
    )
  );

create policy "requests_insert_own" on public.customer_requests
  for insert with check (customer_id = auth.uid());

create policy "requests_update_own" on public.customer_requests
  for update using (customer_id = auth.uid() or public.is_admin());

-- Request targets
create policy "targets_select" on public.request_targets
  for select using (
    public.is_store_member(store_id)
    or public.is_admin()
    or exists (
      select 1 from public.customer_requests cr
      where cr.id = request_id and cr.customer_id = auth.uid()
    )
  );

create policy "targets_insert_service" on public.request_targets
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.customer_requests cr
      where cr.id = request_id and cr.customer_id = auth.uid()
    )
  );

create policy "targets_update_member" on public.request_targets
  for update using (public.is_store_member(store_id) or public.is_admin());

-- Store responses
create policy "responses_select" on public.store_responses
  for select using (
    public.is_store_member(store_id)
    or public.is_admin()
    or exists (
      select 1 from public.customer_requests cr
      where cr.id = request_id and cr.customer_id = auth.uid()
    )
  );

create policy "responses_insert_member" on public.store_responses
  for insert with check (
    public.is_store_member(store_id)
    and responded_by = auth.uid()
    and exists (
      select 1 from public.request_targets rt
      where rt.request_id = request_id and rt.store_id = store_id
    )
  );

create policy "responses_update_member" on public.store_responses
  for update using (public.is_store_member(store_id) and (responded_by = auth.uid() or public.can_manage_store(store_id)));

-- Saved requests
create policy "saved_own" on public.saved_requests
  for all using (customer_id = auth.uid());

-- Notifications
create policy "notifications_own" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert with check (true);

-- Subscriptions
create policy "subscriptions_read" on public.subscriptions
  for select using (public.can_manage_store(store_id) or public.is_admin());
create policy "subscriptions_write" on public.subscriptions
  for all using (public.store_role(store_id) = 'owner' or public.is_admin());

-- Reports
create policy "reports_insert" on public.reports
  for insert with check (reported_by = auth.uid());
create policy "reports_select" on public.reports
  for select using (reported_by = auth.uid() or public.is_admin());
create policy "reports_admin_update" on public.reports
  for update using (public.is_admin());

-- Prohibited terms (readable by authenticated, writable by admin)
create policy "prohibited_read" on public.prohibited_terms
  for select using (auth.uid() is not null);
create policy "prohibited_admin" on public.prohibited_terms
  for all using (public.is_admin());

-- Location demand
create policy "location_demand_insert" on public.location_demand
  for insert with check (auth.uid() is not null);
create policy "location_demand_admin" on public.location_demand
  for select using (public.is_admin());

-- Analytics events: insert authenticated, admin read
create policy "analytics_insert" on public.analytics_events
  for insert with check (auth.uid() is not null);
create policy "analytics_admin_read" on public.analytics_events
  for select using (public.is_admin());

-- Seed prohibited terms
insert into public.prohibited_terms (term, reason) values
  ('illegal drugs', 'Controlled substances'),
  ('cocaine', 'Controlled substances'),
  ('heroin', 'Controlled substances'),
  ('fentanyl', 'Controlled substances'),
  ('counterfeit money', 'Illegal'),
  ('stolen goods', 'Illegal')
on conflict (term) do nothing;

-- Storage bucket note: create `product-images` bucket via dashboard or:
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
