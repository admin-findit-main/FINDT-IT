-- Replace QR check-ins with a staff-operated Hub customer workspace.
-- Historical verified visits remain immutable for billing/audit history.

alter table public.store_customers
  add column if not exists removed_at timestamptz;

create index if not exists store_customers_active_store_seen_idx
  on public.store_customers (store_id, last_seen_at desc, id desc)
  where removed_at is null;

-- A later confirmed purchase reactivates a previously removed store
-- relationship while preserving its points and purchase history.
create or replace function public.reactivate_store_customer_on_purchase()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.store_customers
  set removed_at = null,
      last_seen_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = new.store_customer_id
    and store_id = new.store_id
    and removed_at is not null;
  return new;
end;
$$;

revoke all on function public.reactivate_store_customer_on_purchase()
  from public, anon, authenticated;

drop trigger if exists store_purchases_reactivate_customer
  on public.store_purchases;
create trigger store_purchases_reactivate_customer
  before insert on public.store_purchases
  for each row
  execute function public.reactivate_store_customer_on_purchase();

-- Stop the QR-token lifecycle. Keep redeemed rows and verified visits only as
-- historical evidence for already-issued statements and disputes.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id
  from cron.job
  where jobname = 'purge-expired-checkin-tokens'
  limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end;
$$;

delete from public.store_checkin_tokens
where used_at is null;

comment on table public.store_checkin_tokens is
  'Legacy QR check-in tokens. QR check-in was decommissioned; retained redeemed rows are historical audit evidence only.';

comment on table public.verified_visits is
  'Historical verified-visit and billing records. New Hub customer activity uses staff-confirmed store purchases without QR technology.';
