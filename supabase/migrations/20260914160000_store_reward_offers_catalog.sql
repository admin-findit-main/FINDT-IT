-- Named store reward offers, e.g. "350 points = free vape up to $10".
-- Mutations go through service-role RPCs / server actions; clients get read RLS.

create table if not exists public.store_reward_offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  description text,
  points_cost integer not null,
  max_value_cents integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_reward_offers_title_len
    check (char_length(title) between 1 and 80),
  constraint store_reward_offers_description_len
    check (description is null or char_length(description) <= 280),
  constraint store_reward_offers_points_cost_range
    check (points_cost between 1 and 10_000_000),
  constraint store_reward_offers_max_value_range
    check (
      max_value_cents is null
      or (max_value_cents >= 0 and max_value_cents <= 1_000_000_000)
    ),
  constraint store_reward_offers_sort_range
    check (sort_order between 0 and 10_000)
);

create index if not exists store_reward_offers_store_active_idx
  on public.store_reward_offers (store_id, is_active, sort_order, created_at);

drop trigger if exists trg_store_reward_offers_updated on public.store_reward_offers;
create trigger trg_store_reward_offers_updated
  before update on public.store_reward_offers
  for each row execute function public.set_updated_at();

comment on table public.store_reward_offers is
  'Owner-defined redeemable prizes for a store loyalty balance (points cost + optional dollar cap).';

create table if not exists public.store_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  offer_id uuid not null references public.store_reward_offers(id) on delete restrict,
  store_customer_id uuid not null
    references public.store_customers(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  points_spent integer not null,
  max_value_cents integer,
  title text not null,
  employee_user_id uuid references public.profiles(id) on delete set null,
  shift_employee_id uuid,
  hub_device_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint store_reward_redemptions_points_positive
    check (points_spent > 0),
  constraint store_reward_redemptions_title_len
    check (char_length(title) between 1 and 80),
  constraint store_reward_redemptions_idempotency_len
    check (char_length(idempotency_key) between 8 and 160)
);

create unique index if not exists store_reward_redemptions_store_idem_uidx
  on public.store_reward_redemptions (store_id, idempotency_key);

create index if not exists store_reward_redemptions_customer_idx
  on public.store_reward_redemptions (store_customer_id, created_at desc);

comment on table public.store_reward_redemptions is
  'Append-only record of store loyalty redemptions. Balance changes only via redeem_store_reward_offer.';

alter table public.store_reward_offers enable row level security;
alter table public.store_reward_offers force row level security;
alter table public.store_reward_redemptions enable row level security;
alter table public.store_reward_redemptions force row level security;

revoke all on public.store_reward_offers from anon, authenticated;
revoke all on public.store_reward_redemptions from anon, authenticated;

grant select on public.store_reward_offers to authenticated;
grant select on public.store_reward_redemptions to authenticated;

drop policy if exists store_reward_offers_read on public.store_reward_offers;
create policy store_reward_offers_read on public.store_reward_offers
  for select to authenticated
  using (
    public.is_store_member(store_id)
    or public.is_admin()
    or (
      is_active = true
      and exists (
        select 1
        from public.store_customers sc
        where sc.store_id = store_reward_offers.store_id
          and sc.customer_id = (select auth.uid())
          and sc.removed_at is null
      )
    )
  );

drop policy if exists store_reward_redemptions_read on public.store_reward_redemptions;
create policy store_reward_redemptions_read on public.store_reward_redemptions
  for select to authenticated
  using (
    public.is_store_member(store_id)
    or public.is_admin()
    or customer_id = (select auth.uid())
  );

-- Atomic Hub/staff redemption: deducts points and writes redemption + ledger.
create or replace function public.redeem_store_reward_offer(
  p_store_id uuid,
  p_offer_id uuid,
  p_store_customer_id uuid,
  p_idempotency_key text,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null
)
returns table (
  redemption_id uuid,
  points_spent integer,
  points_balance integer,
  title text,
  max_value_cents integer,
  already_redeemed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_offer public.store_reward_offers%rowtype;
  v_relationship public.store_customers%rowtype;
  v_existing public.store_reward_redemptions%rowtype;
  v_redemption public.store_reward_redemptions%rowtype;
begin
  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid reward redemption';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'store-reward-redeem:' || p_store_id::text || ':' || p_idempotency_key,
      0
    )
  );

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  ) or not private.is_valid_store_operator(
    p_store_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id
  ) then
    raise exception 'Invalid reward redemption';
  end if;

  select r.*
  into v_existing
  from public.store_reward_redemptions r
  where r.store_id = p_store_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.offer_id is distinct from p_offer_id
       or v_existing.store_customer_id is distinct from p_store_customer_id then
      raise exception 'Invalid reward redemption';
    end if;
    return query
      select
        v_existing.id,
        v_existing.points_spent,
        sc.points_balance,
        v_existing.title,
        v_existing.max_value_cents,
        true
      from public.store_customers sc
      where sc.id = v_existing.store_customer_id
        and sc.store_id = p_store_id;
    return;
  end if;

  select o.*
  into v_offer
  from public.store_reward_offers o
  where o.id = p_offer_id
    and o.store_id = p_store_id
  for share;

  if v_offer.id is null or v_offer.is_active is not true then
    raise exception 'Reward offer is not available';
  end if;

  select sc.*
  into v_relationship
  from public.store_customers sc
  where sc.id = p_store_customer_id
    and sc.store_id = p_store_id
    and sc.removed_at is null
    and sc.merged_into_store_customer_id is null
  for update;

  if v_relationship.id is null then
    raise exception 'Customer rewards not found';
  end if;

  if v_relationship.points_balance < v_offer.points_cost then
    raise exception 'Not enough points for this reward';
  end if;

  update public.store_customers sc
  set points_balance = sc.points_balance - v_offer.points_cost,
      last_seen_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where sc.id = v_relationship.id
  returning * into v_relationship;

  insert into public.store_reward_redemptions (
    store_id,
    offer_id,
    store_customer_id,
    customer_id,
    points_spent,
    max_value_cents,
    title,
    employee_user_id,
    shift_employee_id,
    hub_device_id,
    idempotency_key
  )
  values (
    p_store_id,
    v_offer.id,
    v_relationship.id,
    v_relationship.customer_id,
    v_offer.points_cost,
    v_offer.max_value_cents,
    v_offer.title,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id,
    p_idempotency_key
  )
  returning * into v_redemption;

  if v_relationship.customer_id is not null then
    insert into public.reward_ledger (
      user_id,
      store_id,
      employee_user_id,
      reward_type,
      audience,
      points,
      estimated_value_cents,
      status,
      reason,
      program
    )
    values (
      v_relationship.customer_id,
      p_store_id,
      p_employee_user_id,
      'store_reward_redeem',
      'shopper',
      -v_offer.points_cost,
      v_offer.max_value_cents,
      'redeemed',
      'Redeemed: ' || v_offer.title,
      'store_loyalty'
    );
  end if;

  return query
    select
      v_redemption.id,
      v_redemption.points_spent,
      v_relationship.points_balance,
      v_redemption.title,
      v_redemption.max_value_cents,
      false;
end;
$$;

revoke all on function public.redeem_store_reward_offer(
  uuid, uuid, uuid, text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.redeem_store_reward_offer(
  uuid, uuid, uuid, text, uuid, uuid, uuid
) to service_role;

comment on function public.redeem_store_reward_offer(
  uuid, uuid, uuid, text, uuid, uuid, uuid
) is
  'Service-role Hub/staff redemption of a named store reward offer. Deducts store loyalty points atomically.';
