-- One active hashed email code per applicant. Service role only — we do not
-- create a store login or store_applications row until this code is confirmed.
-- Phone confirmation can be added later (Twilio).

create table if not exists public.store_join_email_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.store_join_email_codes is
  'Hashed 6-digit codes that confirm a store applicant email before an account or application is created.';

alter table public.store_join_email_codes enable row level security;
alter table public.store_join_email_codes force row level security;

revoke all on public.store_join_email_codes from public, anon, authenticated;
grant all on public.store_join_email_codes to service_role;
