-- Harden the Phase 1 loyalty foundation before any product surface uses it.
-- Additive/backward-safe except that unproven promotion consent is reset to
-- false. No request-routing or verified-visit behavior is changed.

-- ---------------------------------------------------------------------------
-- 1. Phone verification is server-controlled
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_locked_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.account_type is distinct from old.account_type
       or new.subscription_plan is distinct from old.subscription_plan
       or new.is_suspended is distinct from old.is_suspended
       or new.phone_e164 is distinct from old.phone_e164
       or new.phone_verified is distinct from old.phone_verified
       or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Account role, plan, and verified contact fields cannot be changed from the client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_locked_fields on public.profiles;
create trigger profiles_protect_locked_fields
  before update of
    account_type,
    subscription_plan,
    is_suspended,
    phone_e164,
    phone_verified,
    phone_verified_at
  on public.profiles
  for each row
  execute function public.protect_profile_locked_fields();

revoke all on function public.protect_profile_locked_fields()
  from public, anon, authenticated;

-- An OS push permission or a customer/store relationship is not marketing
-- consent. Existing rows have no affirmative consent evidence, so they stay
-- opted out until the shopper explicitly enables promotions.
alter table public.profiles
  alter column notify_store_promotions set default false;

update public.profiles
set notify_store_promotions = false
where notify_store_promotions = true;

alter table public.store_customers
  alter column marketing_opt_in set default false;

update public.store_customers
set marketing_opt_in = false
where marketing_opt_in = true;

-- ---------------------------------------------------------------------------
-- 2. Relationship and pending-claim consistency
-- ---------------------------------------------------------------------------

-- Preserve purchase history when a shopper deletes their account. The
-- relationship becomes anonymous instead of cascading into past purchases.
alter table public.store_customers
  drop constraint if exists store_customers_customer_id_fkey;

alter table public.store_customers
  add constraint store_customers_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete set null;

-- Claims need store_id on the row to enforce one open record per phone/store.
alter table public.store_customer_claims
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

update public.store_customer_claims c
set store_id = sc.store_id
from public.store_customers sc
where sc.id = c.store_customer_id
  and c.store_id is null;

alter table public.store_customer_claims
  alter column store_id set not null;

drop index if exists public.store_customer_claims_open_phone_uidx;
create unique index store_customer_claims_open_phone_uidx
  on public.store_customer_claims (store_id, phone_e164)
  where claimed_at is null;

create index if not exists store_customer_claims_store_idx
  on public.store_customer_claims (store_id, created_at desc);

create index if not exists store_customer_claims_claimed_by_idx
  on public.store_customer_claims (claimed_by)
  where claimed_by is not null;

-- The store and customer copied onto a purchase/ledger row must agree with
-- the relationship they reference. Composite unique constraints provide FK
-- targets while keeping the existing UUID primary keys.
alter table public.store_customers
  add constraint store_customers_id_store_customer_key
  unique (id, store_id, customer_id);

alter table public.store_purchases
  drop constraint if exists store_purchases_store_customer_id_fkey;

alter table public.store_purchases
  add constraint store_purchases_store_customer_id_fkey
  foreign key (store_customer_id)
  references public.store_customers(id)
  on delete restrict;

alter table public.store_purchases
  add constraint store_purchases_relationship_identity_fkey
  foreign key (store_customer_id, store_id, customer_id)
  references public.store_customers(id, store_id, customer_id);

alter table public.store_purchases
  add column if not exists shift_employee_id uuid
    references public.store_shift_employees(id) on delete set null,
  add column if not exists hub_device_id uuid
    references public.store_devices(id) on delete set null;

create index if not exists store_purchases_employee_user_idx
  on public.store_purchases (employee_user_id)
  where employee_user_id is not null;

create index if not exists store_purchases_shift_employee_idx
  on public.store_purchases (shift_employee_id)
  where shift_employee_id is not null;

create index if not exists store_purchases_hub_device_idx
  on public.store_purchases (hub_device_id)
  where hub_device_id is not null;

alter table public.store_purchases
  add constraint store_purchases_id_store_customer_key
  unique (id, store_id, customer_id);

alter table public.reward_ledger
  add constraint reward_ledger_purchase_identity_fkey
  foreign key (store_purchase_id, store_id, user_id)
  references public.store_purchases(id, store_id, customer_id);

alter table public.reward_ledger
  add constraint reward_ledger_store_loyalty_shape_check
  check (
    program <> 'store_loyalty'
    or (
      store_id is not null
      and store_purchase_id is not null
      and audience = 'shopper'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. RLS/grants match the product boundary
-- ---------------------------------------------------------------------------

alter table public.store_customers force row level security;
alter table public.store_customer_claims force row level security;
alter table public.store_purchases force row level security;
alter table public.store_reward_settings force row level security;

-- Owners/managers get the customer directory and purchase history. Employees
-- receive only a privacy-shaped lookup result from trusted server actions.
drop policy if exists store_customers_read on public.store_customers;
create policy store_customers_read on public.store_customers
  for select to authenticated
  using (
    (customer_id is not null and customer_id = (select auth.uid()))
    or public.can_manage_store(store_id)
    or public.is_admin()
  );

drop policy if exists store_purchases_read on public.store_purchases;
create policy store_purchases_read on public.store_purchases
  for select to authenticated
  using (
    (customer_id is not null and customer_id = (select auth.uid()))
    or public.can_manage_store(store_id)
    or public.is_admin()
  );

-- All loyalty writes use the service role after application authorization.
drop policy if exists store_reward_settings_write
  on public.store_reward_settings;

revoke all on public.store_customers from anon, authenticated;
revoke all on public.store_customer_claims from anon, authenticated;
revoke all on public.store_purchases from anon, authenticated;
revoke all on public.store_reward_settings from anon, authenticated;

grant select on public.store_customers to authenticated;
grant select on public.store_purchases to authenticated;
grant select on public.store_reward_settings to authenticated;

grant all on public.store_customers to service_role;
grant all on public.store_customer_claims to service_role;
grant all on public.store_purchases to service_role;
grant all on public.store_reward_settings to service_role;

-- ---------------------------------------------------------------------------
-- 4. One atomic purchase + points operation
-- ---------------------------------------------------------------------------

create or replace function public.confirm_store_purchase(
  p_store_id uuid,
  p_customer_id uuid,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null,
  p_request_id uuid default null,
  p_source text default 'phone_lookup',
  p_idempotency_key text default null
)
returns table (
  purchase_id uuid,
  store_customer_id uuid,
  points_awarded integer,
  points_balance integer,
  already_confirmed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.store_purchases%rowtype;
  v_relationship public.store_customers%rowtype;
  v_purchase public.store_purchases%rowtype;
  v_points integer := 0;
  v_value_cents integer := 0;
begin
  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 8
     or char_length(p_idempotency_key) > 160 then
    raise exception 'Invalid purchase idempotency key';
  end if;

  if p_source not in ('request', 'phone_lookup') then
    raise exception 'Invalid purchase confirmation source';
  end if;

  -- Serialize retries/double taps for the same logical operation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_store_id::text || ':' || p_idempotency_key,
      0
    )
  );

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  ) then
    raise exception 'Store is not active';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_customer_id
      and p.account_type = 'customer'
      and p.is_suspended = false
      and (
        p_source = 'request'
        or (p.phone_e164 is not null and p.phone_verified = true)
      )
  ) then
    raise exception 'Customer is not eligible for purchase confirmation';
  end if;

  if p_employee_user_id is null
     and p_shift_employee_id is null
     and p_hub_device_id is null then
    raise exception 'Employee or Hub attribution is required';
  end if;

  if p_employee_user_id is not null and not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and (
        s.owner_id = p_employee_user_id
        or exists (
          select 1
          from public.store_members sm
          where sm.store_id = p_store_id
            and sm.user_id = p_employee_user_id
            and sm.status = 'active'
        )
      )
  ) then
    raise exception 'Employee does not belong to this store';
  end if;

  if p_shift_employee_id is not null and not exists (
    select 1
    from public.store_shift_employees se
    where se.id = p_shift_employee_id
      and se.store_id = p_store_id
      and se.active = true
      and exists (
        select 1
        from public.store_shift_punches sp
        where sp.employee_id = se.id
          and sp.store_id = p_store_id
          and sp.clocked_out_at is null
      )
  ) then
    raise exception 'Shift employee is not clocked in at this store';
  end if;

  if p_hub_device_id is not null and not exists (
    select 1
    from public.store_devices d
    where d.id = p_hub_device_id
      and d.store_id = p_store_id
      and d.revoked_at is null
  ) then
    raise exception 'Hub device is not active for this store';
  end if;

  select *
  into v_existing
  from public.store_purchases p
  where p.store_id = p_store_id
    and p.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.customer_id is distinct from p_customer_id then
      raise exception 'Purchase key belongs to a different customer';
    end if;
    return query
      select
        v_existing.id,
        v_existing.store_customer_id,
        v_existing.points_awarded,
        sc.points_balance,
        true
      from public.store_customers sc
      where sc.id = v_existing.store_customer_id;
    return;
  end if;

  if p_source = 'request' then
    if p_request_id is null or not exists (
      select 1
      from public.customer_requests r
      join public.request_targets rt
        on rt.request_id = r.id
       and rt.store_id = p_store_id
      join public.store_responses sr
        on sr.request_id = r.id
       and sr.store_id = p_store_id
      where r.id = p_request_id
        and r.customer_id = p_customer_id
        and sr.response_type in ('in_stock', 'can_order')
    ) then
      raise exception 'Request is not eligible for purchase confirmation';
    end if;

    select *
    into v_existing
    from public.store_purchases p
    where p.request_id = p_request_id
      and p.status = 'confirmed';

    if found then
      return query
        select
          v_existing.id,
          v_existing.store_customer_id,
          v_existing.points_awarded,
          sc.points_balance,
          true
        from public.store_customers sc
        where sc.id = v_existing.store_customer_id;
      return;
    end if;
  elsif p_request_id is not null then
    raise exception 'Phone lookup purchases cannot attach a request';
  end if;

  insert into public.store_customers (
    store_id,
    customer_id,
    marketing_opt_in,
    first_seen_at,
    last_seen_at
  )
  values (
    p_store_id,
    p_customer_id,
    false,
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (store_id, customer_id)
    where customer_id is not null
  do update set
    last_seen_at = excluded.last_seen_at,
    updated_at = pg_catalog.now()
  returning * into v_relationship;

  select
    case when rs.enabled then rs.points_per_purchase else 0 end,
    case
      when rs.enabled then
        pg_catalog.round(
          rs.points_per_purchase::numeric
          * rs.reward_value_cents::numeric
          / rs.reward_threshold_points::numeric
        )::integer
      else 0
    end
  into v_points, v_value_cents
  from public.store_reward_settings rs
  where rs.store_id = p_store_id;

  v_points := coalesce(v_points, 0);
  v_value_cents := coalesce(v_value_cents, 0);

  insert into public.store_purchases (
    store_id,
    store_customer_id,
    customer_id,
    employee_user_id,
    shift_employee_id,
    hub_device_id,
    request_id,
    source,
    points_awarded,
    status,
    idempotency_key,
    confirmed_at
  )
  values (
    p_store_id,
    v_relationship.id,
    p_customer_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id,
    p_request_id,
    p_source,
    v_points,
    'confirmed',
    p_idempotency_key,
    pg_catalog.now()
  )
  returning * into v_purchase;

  update public.store_customers as sc
  set points_balance = sc.points_balance + v_points,
      lifetime_points = sc.lifetime_points + v_points,
      confirmed_purchases = sc.confirmed_purchases + 1,
      last_seen_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = v_relationship.id
  returning * into v_relationship;

  if v_points > 0 then
    insert into public.reward_ledger (
      user_id,
      store_id,
      store_purchase_id,
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
      p_customer_id,
      p_store_id,
      v_purchase.id,
      p_employee_user_id,
      'store_purchase',
      'shopper',
      v_points,
      v_value_cents,
      'confirmed',
      'Confirmed store purchase',
      'store_loyalty'
    );
  end if;

  return query
    select
      v_purchase.id,
      v_relationship.id,
      v_points,
      v_relationship.points_balance,
      false;
end;
$$;

revoke all on function public.confirm_store_purchase(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.confirm_store_purchase(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text
) to service_role;

comment on function public.confirm_store_purchase(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text
) is
  'Service-role-only atomic purchase confirmation. Validates store/customer/employee identity, deduplicates, updates the relationship, and appends store loyalty points.';
