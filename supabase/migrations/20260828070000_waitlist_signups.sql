-- Public waitlist from askfindit.com. Inserts go through the Next.js server
-- with the service role. Anon and signed-in users have no table grants.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  audience text not null check (audience in ('shopper', 'store')),
  display_name text,
  store_name text,
  created_at timestamptz not null default now(),
  constraint waitlist_signups_email_len check (char_length(email) between 3 and 254)
);

comment on table public.waitlist_signups is
  'Shopper and store waitlist from the public website. Service role only.';

create unique index if not exists waitlist_signups_email_audience_idx
  on public.waitlist_signups (lower(email), audience);

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
alter table public.waitlist_signups force row level security;

revoke all on public.waitlist_signups from public, anon, authenticated;
grant all on public.waitlist_signups to service_role;
