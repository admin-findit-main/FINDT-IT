-- PostgreSQL special-form COALESCE cannot be schema-qualified. Repair the
-- already-deployed trigger while keeping fresh installs correct in the
-- foundational customer_find_grants migration.
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
