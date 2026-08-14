-- FINDIT: store join applications + customer plans + store trial
-- Apply after 20260326000001_init.sql when using Supabase.
-- Demo mode persists these in-memory (see src/lib/demo/store.ts).

-- Customer plan on profiles (FINDIT FREE / FINDIT+)
alter table public.profiles
  add column if not exists subscription_plan text not null default 'free'
    check (subscription_plan in ('free', 'plus'));

-- Store 60-day free trial / pilot end date
alter table public.stores
  add column if not exists trial_ends_at timestamptz;

-- Businesses request to join; admins approve before store dashboard access
create table if not exists public.store_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text not null,
  street_address text not null,
  city text not null,
  state text not null default 'VA',
  postal_code text not null,
  phone text not null,
  website text,
  owner_name text not null,
  owner_email text not null,
  owner_phone text,
  why_legit text not null,
  confirmed_legitimate boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  applicant_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_applications_status_idx
  on public.store_applications (status, created_at desc);

alter table public.store_applications enable row level security;

-- Public can insert applications (join form); only admins read/update
create policy "Anyone can submit store applications"
  on public.store_applications for insert
  with check (confirmed_legitimate = true);

create policy "Admins can read store applications"
  on public.store_applications for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'admin'
    )
  );

create policy "Admins can update store applications"
  on public.store_applications for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'admin'
    )
  );
