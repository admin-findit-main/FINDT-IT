-- Operator audit trail. Service role writes only. No payment or secret fields.

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource text,
  ip text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_events_created_idx
  on public.security_audit_events (created_at desc);

create index if not exists security_audit_events_action_idx
  on public.security_audit_events (action, created_at desc);

comment on table public.security_audit_events is
  'Security-sensitive actions for Admin. No raw credentials.';

alter table public.security_audit_events enable row level security;
alter table public.security_audit_events force row level security;

create policy security_audit_admin_read on public.security_audit_events
  for select
  to authenticated
  using (public.is_admin());

revoke all on public.security_audit_events from public, anon, authenticated;
grant all on public.security_audit_events to service_role;
grant select on public.security_audit_events to authenticated;

create index if not exists profiles_suspended_idx
  on public.profiles (is_suspended)
  where is_suspended = true;
