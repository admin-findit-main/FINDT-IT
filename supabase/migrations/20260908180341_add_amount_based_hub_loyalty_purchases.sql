-- Add amount-based Hub loyalty purchases without changing the legacy
-- per-purchase or request-confirmation flows.

-- Historical purchases did not capture an amount, so zero is the only safe
-- backfill. New amount RPCs require a positive value before inserting.
alter table public.store_purchases
  add column amount_cents integer not null default 0;

alter table public.store_purchases
  add constraint store_purchases_amount_cents_range
  check (amount_cents between 0 and 99999999) not valid;

alter table public.store_purchases
  validate constraint store_purchases_amount_cents_range;

comment on column public.store_purchases.amount_cents is
  'Purchase subtotal used for amount-based Hub loyalty awards, in whole cents. Zero identifies historical or legacy confirmations without a captured amount.';

-- Keep points_per_purchase unchanged for legacy and request confirmations.
alter table public.store_reward_settings
  add column points_per_dollar integer not null default 1;

alter table public.store_reward_settings
  add constraint store_reward_settings_points_per_dollar_range
  check (points_per_dollar between 1 and 1000) not valid;

alter table public.store_reward_settings
  validate constraint store_reward_settings_points_per_dollar_range;

comment on column public.store_reward_settings.points_per_dollar is
  'Amount-based Hub award rate. Only complete dollars earn points: floor(amount_cents * points_per_dollar / 100).';

create function public.confirm_hub_amount_purchase(
  p_store_id uuid,
  p_customer_id uuid,
  p_employee_user_id uuid,
  p_shift_employee_id uuid,
  p_hub_device_id uuid,
  p_amount_cents integer,
  p_idempotency_key text
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
  v_rewards_enabled boolean := false;
  v_points_per_dollar integer := 1;
  v_reward_threshold_points integer := 1;
  v_reward_value_cents integer := 0;
  v_points integer := 0;
  v_value_cents integer := 0;
begin
  if p_amount_cents is null
     or p_amount_cents not between 1 and 99999999
     or p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid amount purchase operation';
  end if;

  -- Share the lock namespace with every existing purchase RPC so a key cannot
  -- race between legacy, pending, and amount-based confirmations.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'store-purchase:' || p_store_id::text || ':' || p_idempotency_key,
      0
    )
  );

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  )
  or not private.is_valid_store_operator(
    p_store_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id
  )
  or not exists (
    select 1
    from public.profiles p
    where p.id = p_customer_id
      and p.account_type = 'customer'
      and p.is_suspended = false
      and private.has_confirmed_email(p.id)
  ) then
    raise exception 'Invalid amount purchase operation';
  end if;

  select sp.*
  into v_existing
  from public.store_purchases sp
  where sp.store_id = p_store_id
    and sp.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.customer_id is distinct from p_customer_id
       or v_existing.amount_cents is distinct from p_amount_cents
       or v_existing.source <> 'phone_lookup' then
      raise exception 'Invalid amount purchase operation';
    end if;

    return query
      select
        v_existing.id,
        v_existing.store_customer_id,
        v_existing.points_awarded,
        sc.points_balance,
        true
      from public.store_customers sc
      where sc.id = v_existing.store_customer_id
        and sc.store_id = p_store_id
        and sc.customer_id = p_customer_id;
    return;
  end if;

  insert into public.store_customers as sc (
    store_id,
    customer_id,
    marketing_opt_in,
    first_seen_at,
    last_seen_at,
    removed_at
  )
  values (
    p_store_id,
    p_customer_id,
    false,
    pg_catalog.now(),
    pg_catalog.now(),
    null
  )
  on conflict (store_id, customer_id)
    where customer_id is not null
  do update set
    last_seen_at = excluded.last_seen_at,
    removed_at = null,
    updated_at = pg_catalog.now()
  returning * into v_relationship;

  -- Explicitly lock the canonical relationship before changing any counters.
  select sc.*
  into v_relationship
  from public.store_customers sc
  where sc.id = v_relationship.id
    and sc.store_id = p_store_id
    and sc.customer_id = p_customer_id
  for update;

  if v_relationship.id is null
     or v_relationship.merged_into_store_customer_id is not null then
    raise exception 'Invalid amount purchase operation';
  end if;

  select
    rs.enabled,
    rs.points_per_dollar,
    rs.reward_threshold_points,
    rs.reward_value_cents
  into
    v_rewards_enabled,
    v_points_per_dollar,
    v_reward_threshold_points,
    v_reward_value_cents
  from public.store_reward_settings rs
  where rs.store_id = p_store_id
  for share;

  if coalesce(v_rewards_enabled, false) then
    v_points := pg_catalog.floor(
      p_amount_cents::numeric
      * v_points_per_dollar::numeric
      / 100::numeric
    )::integer;
    v_value_cents := pg_catalog.round(
      v_points::numeric
      * v_reward_value_cents::numeric
      / v_reward_threshold_points::numeric
    )::integer;
  end if;

  insert into public.store_purchases (
    store_id,
    store_customer_id,
    customer_id,
    employee_user_id,
    shift_employee_id,
    hub_device_id,
    request_id,
    source,
    amount_cents,
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
    null,
    'phone_lookup',
    p_amount_cents,
    v_points,
    'confirmed',
    p_idempotency_key,
    pg_catalog.now()
  )
  returning * into v_purchase;

  update public.store_customers sc
  set points_balance = sc.points_balance + v_points,
      lifetime_points = sc.lifetime_points + v_points,
      confirmed_purchases = sc.confirmed_purchases + 1,
      last_seen_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where sc.id = v_relationship.id
    and sc.store_id = p_store_id
    and sc.customer_id = p_customer_id
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
      'Confirmed amount-based Hub store purchase',
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
exception
  when unique_violation then
    raise exception 'Invalid amount purchase operation';
end;
$$;

revoke execute on function public.confirm_hub_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) from public, anon, authenticated;

grant execute on function public.confirm_hub_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) to service_role;

comment on function public.confirm_hub_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) is
  'Service-role-only amount-based Hub confirmation for an app-resolved, email-confirmed customer. Uses phone_lookup source and awards only complete-dollar points.';

create function public.confirm_pending_store_amount_purchase(
  p_store_id uuid,
  p_store_customer_id uuid,
  p_employee_user_id uuid,
  p_shift_employee_id uuid,
  p_hub_device_id uuid,
  p_amount_cents integer,
  p_idempotency_key text
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
  v_rewards_enabled boolean := false;
  v_points_per_dollar integer := 1;
  v_reward_threshold_points integer := 1;
  v_reward_value_cents integer := 0;
  v_points integer := 0;
  v_value_cents integer := 0;
begin
  if p_amount_cents is null
     or p_amount_cents not between 1 and 99999999
     or p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid pending amount purchase operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'store-purchase:' || p_store_id::text || ':' || p_idempotency_key,
      0
    )
  );

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  )
  or not private.is_valid_store_operator(
    p_store_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id
  ) then
    raise exception 'Invalid pending amount purchase operation';
  end if;

  select sp.*
  into v_existing
  from public.store_purchases sp
  where sp.store_id = p_store_id
    and sp.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.pending_store_customer_id is distinct from
         p_store_customer_id
       or v_existing.store_customer_id is distinct from p_store_customer_id
       or v_existing.amount_cents is distinct from p_amount_cents
       or v_existing.source <> 'hub_phone_pending' then
      raise exception 'Invalid pending amount purchase operation';
    end if;

    return query
      select
        v_existing.id,
        v_existing.store_customer_id,
        v_existing.points_awarded,
        sc.points_balance,
        true
      from public.store_customers sc
      where sc.id = v_existing.store_customer_id
        and sc.store_id = p_store_id;
    return;
  end if;

  select sc.*
  into v_relationship
  from public.store_customers sc
  where sc.id = p_store_customer_id
    and sc.store_id = p_store_id
  for update;

  if v_relationship.id is null
     or v_relationship.customer_id is not null
     or v_relationship.merged_into_store_customer_id is not null
     or not exists (
       select 1
       from public.store_customer_claims c
       where c.store_customer_id = p_store_customer_id
         and c.store_id = p_store_id
         and c.claimed_at is null
     ) then
    raise exception 'Invalid pending amount purchase operation';
  end if;

  select
    rs.enabled,
    rs.points_per_dollar,
    rs.reward_threshold_points,
    rs.reward_value_cents
  into
    v_rewards_enabled,
    v_points_per_dollar,
    v_reward_threshold_points,
    v_reward_value_cents
  from public.store_reward_settings rs
  where rs.store_id = p_store_id
  for share;

  if coalesce(v_rewards_enabled, false) then
    v_points := pg_catalog.floor(
      p_amount_cents::numeric
      * v_points_per_dollar::numeric
      / 100::numeric
    )::integer;
    v_value_cents := pg_catalog.round(
      v_points::numeric
      * v_reward_value_cents::numeric
      / v_reward_threshold_points::numeric
    )::integer;
  end if;

  insert into public.store_purchases (
    store_id,
    store_customer_id,
    pending_store_customer_id,
    customer_id,
    employee_user_id,
    shift_employee_id,
    hub_device_id,
    request_id,
    source,
    amount_cents,
    points_awarded,
    status,
    idempotency_key,
    confirmed_at
  )
  values (
    p_store_id,
    v_relationship.id,
    v_relationship.id,
    null,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id,
    null,
    'hub_phone_pending',
    p_amount_cents,
    v_points,
    'confirmed',
    p_idempotency_key,
    pg_catalog.now()
  )
  returning * into v_purchase;

  update public.store_customers sc
  set points_balance = sc.points_balance + v_points,
      lifetime_points = sc.lifetime_points + v_points,
      confirmed_purchases = sc.confirmed_purchases + 1,
      last_seen_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where sc.id = v_relationship.id
    and sc.store_id = p_store_id
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
      null,
      p_store_id,
      v_purchase.id,
      p_employee_user_id,
      'store_purchase',
      'shopper',
      v_points,
      v_value_cents,
      'confirmed',
      'Confirmed pending amount-based Hub store purchase',
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
exception
  when unique_violation then
    raise exception 'Invalid pending amount purchase operation';
end;
$$;

revoke execute on function public.confirm_pending_store_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) from public, anon, authenticated;

grant execute on function public.confirm_pending_store_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) to service_role;

comment on function public.confirm_pending_store_amount_purchase(
  uuid, uuid, uuid, uuid, uuid, integer, text
) is
  'Service-role-only amount-based confirmation for an existing open pending relationship. Retains hub_phone_pending origin and null ledger ownership for later claim/merge.';

-- Fail deployment if the additive columns, constraints, function hardening, or
-- existing RLS boundary do not match the intended product contract.
do $$
declare
  v_rpc regprocedure;
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.store_purchases'::regclass
      and a.attname = 'amount_cents'
      and a.atttypid = 'integer'::regtype
      and a.attnotnull
      and not a.attisdropped
      and pg_catalog.pg_get_expr(
        (
          select d.adbin
          from pg_catalog.pg_attrdef d
          where d.adrelid = a.attrelid
            and d.adnum = a.attnum
        ),
        a.attrelid
      ) = '0'
  ) then
    raise exception 'store_purchases.amount_cents is not safely configured';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.store_reward_settings'::regclass
      and a.attname = 'points_per_dollar'
      and a.atttypid = 'integer'::regtype
      and a.attnotnull
      and not a.attisdropped
      and pg_catalog.pg_get_expr(
        (
          select d.adbin
          from pg_catalog.pg_attrdef d
          where d.adrelid = a.attrelid
            and d.adnum = a.attnum
        ),
        a.attrelid
      ) = '1'
  ) then
    raise exception 'store_reward_settings.points_per_dollar is not safely configured';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conname in (
      'store_purchases_amount_cents_range',
      'store_reward_settings_points_per_dollar_range'
    )
      and (not c.convalidated or c.contype <> 'c')
  )
  or (
    select count(*)
    from pg_catalog.pg_constraint c
    where c.conname in (
      'store_purchases_amount_cents_range',
      'store_reward_settings_points_per_dollar_range'
    )
  ) <> 2 then
    raise exception 'Amount loyalty constraints are missing or unvalidated';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'confirm_hub_amount_purchase',
        'confirm_pending_store_amount_purchase'
      )
  ) <> 2 then
    raise exception 'Amount purchase RPC names must not be overloaded';
  end if;

  if pg_catalog.to_regprocedure(
       'public.confirm_store_purchase(uuid,uuid,uuid,uuid,uuid,uuid,text,text)'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.confirm_pending_store_purchase(uuid,uuid,uuid,uuid,uuid,text)'
     ) is null then
    raise exception 'Legacy purchase RPC signatures must remain available';
  end if;

  foreach v_rpc in array array[
    'public.confirm_hub_amount_purchase(uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure,
    'public.confirm_pending_store_amount_purchase(uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure
  ]
  loop
    if exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_rpc
        and (
          p.prosecdef
          or p.proconfig is null
          or not p.proconfig @> array['search_path=""']::text[]
        )
    )
    or pg_catalog.has_function_privilege('anon', v_rpc, 'execute')
    or pg_catalog.has_function_privilege(
      'authenticated',
      v_rpc,
      'execute'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      v_rpc,
      'execute'
    ) then
      raise exception 'Unexpected amount purchase RPC security: %', v_rpc;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'store_customers',
        'store_customer_claims',
        'store_purchases',
        'store_reward_settings',
        'reward_ledger'
      )
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'Amount loyalty tables must retain forced RLS';
  end if;
end;
$$;
