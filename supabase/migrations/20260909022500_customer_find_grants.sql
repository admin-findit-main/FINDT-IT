-- One-month customer Find allowance grants. These are request allowances,
-- never FINDIT Points or reward_ledger entries.

create table public.customer_find_grants (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    references public.profiles(id) on delete restrict,
  period_start date not null
    check (period_start = date_trunc('month', period_start)::date),
  finds integer not null check (finds > 0),
  reason text not null check (btrim(reason) <> ''),
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  granted_by uuid
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.customer_find_grants is
  'Append-only audit log of one-UTC-month customer Find allowance grants.';
comment on column public.customer_find_grants.period_start is
  'First calendar day of the UTC month receiving the allowance.';

create index customer_find_grants_customer_period_idx
  on public.customer_find_grants (customer_id, period_start);

alter table public.customer_find_grants enable row level security;
alter table public.customer_find_grants force row level security;

revoke all on table public.customer_find_grants
  from public, anon, authenticated;
grant select on table public.customer_find_grants to authenticated;
grant all on table public.customer_find_grants to service_role;

create policy customer_find_grants_select_own
  on public.customer_find_grants
  for select
  to authenticated
  using ((select auth.uid()) = customer_id);

create policy customer_find_grants_service_role_all
  on public.customer_find_grants
  for all
  to service_role
  using (true)
  with check (true);

-- A Find is spent when created. Every request status counts. The advisory
-- lock serializes the authoritative cap check for each customer.
create or replace function public.enforce_monthly_find_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan text;
  base_cap bigint;
  bonus_finds bigint;
  cap bigint;
  used bigint;
  utc_period_start date :=
    pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC')::date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.customer_id::text)
  );

  select coalesce(p.subscription_plan, 'free')
    into plan
  from public.profiles as p
  where p.id = new.customer_id;

  base_cap := case when plan = 'plus' then 25 else 5 end;

  select coalesce(pg_catalog.sum(g.finds), 0)
    into bonus_finds
  from public.customer_find_grants as g
  where g.customer_id = new.customer_id
    and g.period_start = utc_period_start;

  cap := base_cap + bonus_finds;

  select pg_catalog.count(*)
    into used
  from public.customer_requests as r
  where r.customer_id = new.customer_id
    and r.created_at >= (utc_period_start::timestamp at time zone 'UTC')
    and r.created_at <
      ((utc_period_start + interval '1 month')::timestamp at time zone 'UTC');

  if used >= cap then
    raise exception 'You''ve used your total Finds allowance of % this month.', cap;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_monthly_find_cap()
  from public, anon, authenticated;
