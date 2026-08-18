-- A Find is spent when it is created. Cancel, expire, or fulfill must not
-- refund the monthly cap. Keep these literals in lockstep with
-- packages/domain/src/constants.ts (FREE_MONTHLY_REQUEST_LIMIT = 5,
-- PLUS_MONTHLY_REQUEST_LIMIT = 25). The domain vitest `edge-sync` test
-- fails if they drift.

create index if not exists idx_customer_requests_customer_created
  on public.customer_requests (customer_id, created_at);

create or replace function public.enforce_monthly_find_cap()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan text;
  cap integer;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.customer_id::text));

  select coalesce(subscription_plan, 'free') into plan
  from public.profiles
  where id = new.customer_id;

  cap := case when plan = 'plus' then 25 else 5 end;

  select count(*)::integer into used
  from public.customer_requests
  where customer_id = new.customer_id
    and created_at >= date_trunc('month', now());

  if used >= cap then
    if plan = 'plus' then
      raise exception 'FINDIT+ includes % Finds per month.', cap;
    else
      raise exception 'You''ve used your % free Finds this month.', cap;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_requests_monthly_find_cap on public.customer_requests;
create trigger customer_requests_monthly_find_cap
  before insert on public.customer_requests
  for each row
  execute function public.enforce_monthly_find_cap();

revoke all on function public.enforce_monthly_find_cap() from public, anon, authenticated;
