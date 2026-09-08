-- Secure Hub-created, store-scoped pending reward relationships.
--
-- The application generates a 12-character Crockford recovery code and sends
-- only its lowercase 64-hex HMAC-SHA256 to these RPCs. The HMAC pepper and the
-- plaintext code never enter Postgres. A pending phone is contact/lookup data,
-- never proof of phone ownership, and claiming never sets phone_verified.

-- ---------------------------------------------------------------------------
-- 1. Claim lifecycle and merge tombstones
-- ---------------------------------------------------------------------------

alter table public.store_customer_claims
  add column if not exists claim_code_hash text,
  add column if not exists code_expires_at timestamptz,
  add column if not exists create_idempotency_key text,
  add column if not exists code_issue_idempotency_key text,
  add column if not exists claim_idempotency_key text,
  add column if not exists claimed_store_customer_id uuid;

alter table public.store_customers
  add column if not exists merged_into_store_customer_id uuid;

alter table public.store_purchases
  add column if not exists pending_store_customer_id uuid;

-- Legacy rows never had a deliverable recovery code. Give each one an
-- unguessable placeholder that is already expired; an authorized explicit
-- issue call can replace it without losing the relationship or its points.
update public.store_customer_claims
set claim_code_hash = pg_catalog.encode(
      extensions.gen_random_bytes(32),
      'hex'
    ),
    code_expires_at = pg_catalog.now() - interval '1 second',
    create_idempotency_key = 'legacy:' || id::text
where claim_code_hash is null
   or code_expires_at is null
   or create_idempotency_key is null;

update public.store_customer_claims
set claimed_store_customer_id = store_customer_id,
    claim_idempotency_key = 'legacy-claim:' || id::text
where claimed_at is not null
  and (
    claimed_store_customer_id is null
    or claim_idempotency_key is null
  );

alter table public.store_customer_claims
  alter column claim_code_hash set not null,
  alter column code_expires_at set not null,
  alter column create_idempotency_key set not null;

alter table public.store_customer_claims
  add constraint store_customer_claims_code_hash_format
    check (claim_code_hash ~ '^[0-9a-f]{64}$') not valid,
  add constraint store_customer_claims_create_idempotency_len
    check (char_length(create_idempotency_key) between 8 and 160) not valid,
  add constraint store_customer_claims_issue_idempotency_len
    check (
      code_issue_idempotency_key is null
      or char_length(code_issue_idempotency_key) between 8 and 160
    ) not valid,
  add constraint store_customer_claims_claim_idempotency_len
    check (
      claim_idempotency_key is null
      or char_length(claim_idempotency_key) between 8 and 160
    ) not valid,
  add constraint store_customer_claims_claim_state
    check (
      (
        claimed_at is null
        and claimed_store_customer_id is null
        and claim_idempotency_key is null
      )
      or (
        claimed_at is not null
        and claimed_store_customer_id is not null
        and claim_idempotency_key is not null
      )
    ) not valid;

alter table public.store_customer_claims
  validate constraint store_customer_claims_code_hash_format,
  validate constraint store_customer_claims_create_idempotency_len,
  validate constraint store_customer_claims_issue_idempotency_len,
  validate constraint store_customer_claims_claim_idempotency_len,
  validate constraint store_customer_claims_claim_state;

create unique index if not exists store_customer_claims_code_hash_uidx
  on public.store_customer_claims (claim_code_hash);

create unique index if not exists store_customer_claims_create_idempotency_uidx
  on public.store_customer_claims (store_id, create_idempotency_key);

create unique index if not exists store_customer_claims_issue_idempotency_uidx
  on public.store_customer_claims (store_id, code_issue_idempotency_key)
  where code_issue_idempotency_key is not null;

create unique index if not exists store_customer_claims_claim_idempotency_uidx
  on public.store_customer_claims (claimed_by, claim_idempotency_key)
  where claimed_by is not null and claim_idempotency_key is not null;

create index if not exists store_customer_claims_open_expiry_idx
  on public.store_customer_claims (code_expires_at)
  where claimed_at is null;

create index if not exists store_customer_claims_claimed_target_idx
  on public.store_customer_claims (claimed_store_customer_id)
  where claimed_store_customer_id is not null;

create index if not exists store_customers_merged_target_idx
  on public.store_customers (merged_into_store_customer_id)
  where merged_into_store_customer_id is not null;

create index if not exists store_purchases_pending_origin_idx
  on public.store_purchases (pending_store_customer_id, confirmed_at desc)
  where pending_store_customer_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Pending ledger ownership and store-consistency foreign keys
-- ---------------------------------------------------------------------------

alter table public.reward_ledger
  drop constraint if exists reward_ledger_user_id_fkey;

alter table public.reward_ledger
  alter column user_id drop not null;

alter table public.reward_ledger
  add constraint reward_ledger_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete set null
  not valid;

alter table public.reward_ledger
  validate constraint reward_ledger_user_id_fkey;

-- UUID primary keys do not by themselves provide a two-column FK target.
-- These keys let store_id remain enforceable when customer_id/user_id is null.
alter table public.store_customers
  add constraint store_customers_id_store_key unique (id, store_id);

alter table public.store_purchases
  add constraint store_purchases_id_store_key unique (id, store_id);

alter table public.store_customer_claims
  add constraint store_customer_claims_relationship_store_fkey
  foreign key (store_customer_id, store_id)
  references public.store_customers(id, store_id)
  on delete cascade
  not valid;

alter table public.store_purchases
  add constraint store_purchases_relationship_store_fkey
  foreign key (store_customer_id, store_id)
  references public.store_customers(id, store_id)
  on delete restrict
  not valid;

alter table public.store_purchases
  add constraint store_purchases_pending_origin_store_fkey
  foreign key (pending_store_customer_id, store_id)
  references public.store_customers(id, store_id)
  on delete restrict
  not valid;

alter table public.reward_ledger
  add constraint reward_ledger_purchase_store_fkey
  foreign key (store_purchase_id, store_id)
  references public.store_purchases(id, store_id)
  not valid;

alter table public.store_customers
  add constraint store_customers_merge_target_store_fkey
  foreign key (merged_into_store_customer_id, store_id)
  references public.store_customers(id, store_id)
  not valid;

alter table public.store_customer_claims
  add constraint store_customer_claims_claimed_target_store_fkey
  foreign key (claimed_store_customer_id, store_id)
  references public.store_customers(id, store_id)
  not valid;

alter table public.store_customer_claims
  validate constraint store_customer_claims_relationship_store_fkey,
  validate constraint store_customer_claims_claimed_target_store_fkey;

alter table public.store_purchases
  validate constraint store_purchases_relationship_store_fkey,
  validate constraint store_purchases_pending_origin_store_fkey;

alter table public.reward_ledger
  validate constraint reward_ledger_purchase_store_fkey;

alter table public.store_customers
  validate constraint store_customers_merge_target_store_fkey;

alter table public.store_customers
  add constraint store_customers_merge_tombstone_shape
  check (
    merged_into_store_customer_id is null
    or (
      customer_id is null
      and removed_at is not null
      and points_balance = 0
      and lifetime_points = 0
      and confirmed_purchases = 0
    )
  ) not valid;

alter table public.store_customers
  validate constraint store_customers_merge_tombstone_shape;

alter table public.store_purchases
  drop constraint if exists store_purchases_source_check;

alter table public.store_purchases
  add constraint store_purchases_source_check
  check (source in ('request', 'phone_lookup', 'hub_phone_pending'));

alter table public.store_purchases
  add constraint store_purchases_pending_origin_shape
  check (
    (
      source = 'hub_phone_pending'
      and pending_store_customer_id is not null
      and request_id is null
    )
    or (
      source <> 'hub_phone_pending'
      and pending_store_customer_id is null
    )
  ) not valid;

alter table public.store_purchases
  validate constraint store_purchases_pending_origin_shape;

-- ---------------------------------------------------------------------------
-- 3. Narrow private authorization helpers
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

create or replace function private.has_confirmed_email(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email is not null
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function private.has_confirmed_email(uuid)
  from public, anon, authenticated;
grant execute on function private.has_confirmed_email(uuid)
  to service_role;

comment on function private.has_confirmed_email(uuid) is
  'Narrow SECURITY DEFINER bridge to Auth email confirmation. Returns no identity data and is executable only by service_role.';

create or replace function private.is_valid_store_operator(
  p_store_id uuid,
  p_employee_user_id uuid,
  p_shift_employee_id uuid,
  p_hub_device_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      p_employee_user_id is not null
      or p_shift_employee_id is not null
      or p_hub_device_id is not null
    )
    and (
      p_employee_user_id is null
      or exists (
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
      )
    )
    and (
      p_shift_employee_id is null
      or exists (
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
      )
    )
    and (
      p_hub_device_id is null
      or exists (
        select 1
        from public.store_devices d
        where d.id = p_hub_device_id
          and d.store_id = p_store_id
          and d.revoked_at is null
      )
    );
$$;

revoke all on function private.is_valid_store_operator(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.is_valid_store_operator(uuid, uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Create or reuse one open pending relationship per store and phone
-- ---------------------------------------------------------------------------

create or replace function public.create_or_get_pending_store_customer(
  p_store_id uuid,
  p_phone_e164 text,
  p_claim_code_hash text,
  p_create_idempotency_key text,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null
)
returns table (
  pending_store_customer_id uuid,
  pending_claim_id uuid,
  code_expires_at timestamptz,
  created boolean,
  supplied_hash_active boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.store_customer_claims%rowtype;
  v_relationship public.store_customers%rowtype;
begin
  if p_phone_e164 is null
     or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
     or p_claim_code_hash is null
     or p_claim_code_hash !~ '^[0-9a-f]{64}$'
     or p_create_idempotency_key is null
     or char_length(p_create_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid pending customer operation';
  end if;

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
    raise exception 'Invalid pending customer operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pending-phone:' || p_store_id::text || ':' || p_phone_e164,
      0
    )
  );

  select c.*
  into v_claim
  from public.store_customer_claims c
  where c.store_id = p_store_id
    and c.create_idempotency_key = p_create_idempotency_key
  for update;

  if found then
    if v_claim.phone_e164 is distinct from p_phone_e164
       or v_claim.claim_code_hash is distinct from p_claim_code_hash then
      raise exception 'Invalid pending customer operation';
    end if;

    return query
      select
        v_claim.store_customer_id,
        v_claim.id,
        v_claim.code_expires_at,
        false,
        (
          v_claim.claimed_at is null
          and v_claim.code_expires_at > pg_catalog.now()
        );
    return;
  end if;

  select c.*
  into v_claim
  from public.store_customer_claims c
  where c.store_id = p_store_id
    and c.phone_e164 = p_phone_e164
    and c.claimed_at is null
  for update;

  if found then
    return query
      select
        v_claim.store_customer_id,
        v_claim.id,
        v_claim.code_expires_at,
        false,
        (
          v_claim.claim_code_hash = p_claim_code_hash
          and v_claim.code_expires_at > pg_catalog.now()
        );
    return;
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
    null,
    false,
    pg_catalog.now(),
    pg_catalog.now()
  )
  returning * into v_relationship;

  insert into public.store_customer_claims (
    store_customer_id,
    store_id,
    phone_e164,
    claim_code_hash,
    code_expires_at,
    create_idempotency_key
  )
  values (
    v_relationship.id,
    p_store_id,
    p_phone_e164,
    p_claim_code_hash,
    pg_catalog.now() + interval '30 days',
    p_create_idempotency_key
  )
  returning * into v_claim;

  return query
    select
      v_relationship.id,
      v_claim.id,
      v_claim.code_expires_at,
      true,
      true;
exception
  when unique_violation then
    raise exception 'Invalid pending customer operation';
end;
$$;

revoke all on function public.create_or_get_pending_store_customer(
  uuid, text, text, text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_or_get_pending_store_customer(
  uuid, text, text, text, uuid, uuid, uuid
) to service_role;

comment on function public.create_or_get_pending_store_customer(
  uuid, text, text, text, uuid, uuid, uuid
) is
  'Service-role-only atomic create-or-get for one open pending loyalty relationship per store and phone. Never rotates an existing code.';

-- ---------------------------------------------------------------------------
-- 5. Explicit authorized recovery-code issue/rotation
-- ---------------------------------------------------------------------------

create or replace function public.issue_pending_store_customer_code(
  p_store_id uuid,
  p_store_customer_id uuid,
  p_expected_claim_code_hash text,
  p_claim_code_hash text,
  p_issue_idempotency_key text,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null
)
returns table (
  pending_claim_id uuid,
  code_expires_at timestamptz,
  already_issued boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.store_customer_claims%rowtype;
  v_relationship public.store_customers%rowtype;
begin
  if p_expected_claim_code_hash is null
     or p_expected_claim_code_hash !~ '^[0-9a-f]{64}$'
     or p_claim_code_hash is null
     or p_claim_code_hash !~ '^[0-9a-f]{64}$'
     or p_issue_idempotency_key is null
     or char_length(p_issue_idempotency_key) not between 8 and 160
     or not exists (
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
    raise exception 'Invalid code issue operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pending-relationship:' || p_store_id::text || ':' ||
        p_store_customer_id::text,
      0
    )
  );

  select c.*
  into v_claim
  from public.store_customer_claims c
  where c.store_customer_id = p_store_customer_id
    and c.store_id = p_store_id
  for update;

  select sc.*
  into v_relationship
  from public.store_customers sc
  where sc.id = p_store_customer_id
    and sc.store_id = p_store_id
  for update;

  if v_relationship.id is null
     or v_relationship.customer_id is not null
     or v_relationship.merged_into_store_customer_id is not null
     or v_claim.id is null
     or v_claim.claimed_at is not null then
    raise exception 'Invalid code issue operation';
  end if;

  if v_claim.code_issue_idempotency_key = p_issue_idempotency_key then
    if v_claim.claim_code_hash is distinct from p_claim_code_hash then
      raise exception 'Invalid code issue operation';
    end if;
    return query
      select v_claim.id, v_claim.code_expires_at, true;
    return;
  end if;

  if exists (
    select 1
    from public.store_customer_claims c
    where c.store_id = p_store_id
      and c.code_issue_idempotency_key = p_issue_idempotency_key
      and c.id <> v_claim.id
  ) then
    raise exception 'Invalid code issue operation';
  end if;

  -- Optimistic hash matching prevents a stale retry from reviving a code
  -- after a later authorized rotation has already replaced it.
  if v_claim.claim_code_hash is distinct from p_expected_claim_code_hash then
    raise exception 'Invalid code issue operation';
  end if;

  update public.store_customer_claims c
  set claim_code_hash = p_claim_code_hash,
      code_expires_at = pg_catalog.now() + interval '30 days',
      code_issue_idempotency_key = p_issue_idempotency_key
  where c.id = v_claim.id
  returning * into v_claim;

  return query
    select v_claim.id, v_claim.code_expires_at, false;
exception
  when unique_violation then
    raise exception 'Invalid code issue operation';
end;
$$;

revoke all on function public.issue_pending_store_customer_code(
  uuid, uuid, text, text, text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.issue_pending_store_customer_code(
  uuid, uuid, text, text, text, uuid, uuid, uuid
) to service_role;

comment on function public.issue_pending_store_customer_code(
  uuid, uuid, text, text, text, uuid, uuid, uuid
) is
  'Service-role-only explicit recovery-code rotation for an open pending relationship. Requires the current hash to prevent stale retries; ordinary lookup and purchase paths never call it.';

-- ---------------------------------------------------------------------------
-- 6. Atomic pending purchase and pending ledger award
-- ---------------------------------------------------------------------------

create or replace function public.confirm_pending_store_purchase(
  p_store_id uuid,
  p_store_customer_id uuid,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null,
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
     or char_length(p_idempotency_key) not between 8 and 160
     or not private.is_valid_store_operator(
       p_store_id,
       p_employee_user_id,
       p_shift_employee_id,
       p_hub_device_id
     ) then
    raise exception 'Invalid pending purchase operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'store-purchase:' || p_store_id::text || ':' || p_idempotency_key,
      0
    )
  );

  select sp.*
  into v_existing
  from public.store_purchases sp
  where sp.store_id = p_store_id
    and sp.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.source <> 'hub_phone_pending'
       or v_existing.pending_store_customer_id is distinct from
         p_store_customer_id then
      raise exception 'Invalid pending purchase operation';
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

  if not exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  ) then
    raise exception 'Invalid pending purchase operation';
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
    raise exception 'Invalid pending purchase operation';
  end if;

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
    pending_store_customer_id,
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
    v_relationship.id,
    null,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id,
    null,
    'hub_phone_pending',
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
      'Confirmed pending Hub store purchase',
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
    raise exception 'Invalid pending purchase operation';
end;
$$;

revoke all on function public.confirm_pending_store_purchase(
  uuid, uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.confirm_pending_store_purchase(
  uuid, uuid, uuid, uuid, uuid, text
) to service_role;

comment on function public.confirm_pending_store_purchase(
  uuid, uuid, uuid, uuid, uuid, text
) is
  'Service-role-only idempotent pending purchase. Locks the pending relationship, records a null-owned purchase, updates totals, and appends a null-owned store loyalty ledger row.';

-- ---------------------------------------------------------------------------
-- 7. Atomic one-time claim and canonical relationship merge
-- ---------------------------------------------------------------------------

create or replace function public.claim_pending_store_customer(
  p_claim_code_hash text,
  p_customer_id uuid,
  p_claim_idempotency_key text
)
returns table (
  store_customer_id uuid,
  points_balance integer,
  lifetime_points integer,
  confirmed_purchases integer,
  merged boolean,
  already_claimed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.store_customer_claims%rowtype;
  v_source public.store_customers%rowtype;
  v_target public.store_customers%rowtype;
  v_purchase_ids uuid[];
  v_target_existed boolean;
begin
  if p_claim_code_hash is null
     or p_claim_code_hash !~ '^[0-9a-f]{64}$'
     or p_customer_id is null
     or p_claim_idempotency_key is null
     or char_length(p_claim_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid or unavailable claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pending-claim-code:' || p_claim_code_hash,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pending-claim-idempotency:' || p_customer_id::text || ':' ||
        p_claim_idempotency_key,
      0
    )
  );

  select c.*
  into v_claim
  from public.store_customer_claims c
  where c.claim_code_hash = p_claim_code_hash
  for update;

  if v_claim.id is null
     or not exists (
       select 1
       from public.profiles p
       where p.id = p_customer_id
         and p.account_type = 'customer'
         and p.is_suspended = false
     )
     or not private.has_confirmed_email(p_customer_id) then
    raise exception 'Invalid or unavailable claim';
  end if;

  if v_claim.claimed_at is not null then
    if v_claim.claimed_by = p_customer_id
       and v_claim.claim_idempotency_key = p_claim_idempotency_key
       and v_claim.claimed_store_customer_id is not null then
      return query
        select
          sc.id,
          sc.points_balance,
          sc.lifetime_points,
          sc.confirmed_purchases,
          sc.id <> v_claim.store_customer_id,
          true
        from public.store_customers sc
        where sc.id = v_claim.claimed_store_customer_id
          and sc.store_id = v_claim.store_id;
      return;
    end if;
    raise exception 'Invalid or unavailable claim';
  end if;

  if v_claim.code_expires_at <= pg_catalog.now()
     or exists (
       select 1
       from public.store_customer_claims c
       where c.claimed_by = p_customer_id
         and c.claim_idempotency_key = p_claim_idempotency_key
         and c.id <> v_claim.id
     ) then
    raise exception 'Invalid or unavailable claim';
  end if;

  -- Lock order is always claim -> pending source -> canonical target.
  select sc.*
  into v_source
  from public.store_customers sc
  where sc.id = v_claim.store_customer_id
    and sc.store_id = v_claim.store_id
  for update;

  if v_source.id is null
     or v_source.customer_id is not null
     or v_source.merged_into_store_customer_id is not null then
    raise exception 'Invalid or unavailable claim';
  end if;

  select exists (
    select 1
    from public.store_customers sc
    where sc.store_id = v_claim.store_id
      and sc.customer_id = p_customer_id
  )
  into v_target_existed;

  insert into public.store_customers as sc (
    store_id,
    customer_id,
    points_balance,
    lifetime_points,
    confirmed_purchases,
    marketing_opt_in,
    first_seen_at,
    last_seen_at,
    removed_at
  )
  values (
    v_claim.store_id,
    p_customer_id,
    0,
    0,
    0,
    false,
    v_source.first_seen_at,
    v_source.last_seen_at,
    null
  )
  on conflict (store_id, customer_id)
    where customer_id is not null
  do update set
    first_seen_at = least(sc.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(sc.last_seen_at, excluded.last_seen_at),
    removed_at = null,
    updated_at = pg_catalog.now()
  returning * into v_target;

  select coalesce(
    pg_catalog.array_agg(sp.id order by sp.id),
    array[]::uuid[]
  )
  into v_purchase_ids
  from public.store_purchases sp
  where sp.store_customer_id = v_source.id
    and sp.store_id = v_claim.store_id;

  if exists (
    select 1
    from public.reward_ledger rl
    where rl.store_purchase_id = any(v_purchase_ids)
      and rl.store_id = v_claim.store_id
      and rl.program = 'store_loyalty'
      and rl.user_id is not null
      and rl.user_id <> p_customer_id
  ) then
    raise exception 'Invalid or unavailable claim';
  end if;

  update public.store_purchases sp
  set store_customer_id = v_target.id,
      customer_id = p_customer_id
  where sp.id = any(v_purchase_ids)
    and sp.store_id = v_claim.store_id;

  update public.reward_ledger rl
  set user_id = p_customer_id
  where rl.store_purchase_id = any(v_purchase_ids)
    and rl.store_id = v_claim.store_id
    and rl.program = 'store_loyalty'
    and rl.user_id is null;

  update public.store_customers sc
  set points_balance = sc.points_balance + v_source.points_balance,
      lifetime_points = sc.lifetime_points + v_source.lifetime_points,
      confirmed_purchases =
        sc.confirmed_purchases + v_source.confirmed_purchases,
      first_seen_at = least(sc.first_seen_at, v_source.first_seen_at),
      last_seen_at = greatest(sc.last_seen_at, v_source.last_seen_at),
      removed_at = null,
      updated_at = pg_catalog.now()
  where sc.id = v_target.id
    and sc.store_id = v_claim.store_id
  returning * into v_target;

  update public.store_customers sc
  set points_balance = 0,
      lifetime_points = 0,
      confirmed_purchases = 0,
      removed_at = pg_catalog.now(),
      merged_into_store_customer_id = v_target.id,
      updated_at = pg_catalog.now()
  where sc.id = v_source.id
    and sc.store_id = v_claim.store_id;

  update public.store_customer_claims c
  set claimed_at = pg_catalog.now(),
      claimed_by = p_customer_id,
      claim_idempotency_key = p_claim_idempotency_key,
      claimed_store_customer_id = v_target.id
  where c.id = v_claim.id;

  return query
    select
      v_target.id,
      v_target.points_balance,
      v_target.lifetime_points,
      v_target.confirmed_purchases,
      v_target_existed,
      false;
exception
  when unique_violation then
    raise exception 'Invalid or unavailable claim';
end;
$$;

revoke all on function public.claim_pending_store_customer(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_pending_store_customer(text, uuid, text)
  to service_role;

comment on function public.claim_pending_store_customer(text, uuid, text) is
  'Service-role-only one-time attachment of a pending store relationship to an email-confirmed customer. Moves purchases and ledger ownership, merges exact counters, and tombstones the source. It never verifies, matches, or updates a phone.';

-- ---------------------------------------------------------------------------
-- 8. Recreate the latest ordinary purchase function explicitly
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
     or char_length(p_idempotency_key) not between 8 and 160
     or p_source not in ('request', 'phone_lookup') then
    raise exception 'Invalid purchase confirmation';
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
  ) or not private.is_valid_store_operator(
    p_store_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id
  ) then
    raise exception 'Invalid purchase confirmation';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_customer_id
      and p.account_type = 'customer'
      and p.is_suspended = false
      and (
        p_source = 'request'
        or private.has_confirmed_email(p.id)
        or (
          p.phone_e164 is not null
          and p.phone_verified = true
        )
      )
  ) then
    raise exception 'Customer is not eligible for purchase confirmation';
  end if;

  select sp.*
  into v_existing
  from public.store_purchases sp
  where sp.store_id = p_store_id
    and sp.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.customer_id is distinct from p_customer_id then
      raise exception 'Invalid purchase confirmation';
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

    select sp.*
    into v_existing
    from public.store_purchases sp
    where sp.request_id = p_request_id
      and sp.status = 'confirmed';

    if found then
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
  elsif p_request_id is not null then
    raise exception 'Invalid purchase confirmation';
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
  'Service-role-only atomic purchase confirmation. Email lookup eligibility requires Auth-confirmed email; relationship upsert locks balance updates.';

-- ---------------------------------------------------------------------------
-- 9. RLS and grants remain deny-by-default for all mutations
-- ---------------------------------------------------------------------------

alter table public.store_customers force row level security;
alter table public.store_customer_claims force row level security;
alter table public.store_purchases force row level security;
alter table public.reward_ledger force row level security;

revoke all on public.store_customer_claims from anon, authenticated;
revoke insert, update, delete, truncate
  on public.store_customers, public.store_purchases, public.reward_ledger
  from anon, authenticated;

grant all on public.store_customers to service_role;
grant all on public.store_customer_claims to service_role;
grant all on public.store_purchases to service_role;
grant all on public.reward_ledger to service_role;

comment on column public.store_customer_claims.claim_code_hash is
  'Lowercase 64-hex HMAC-SHA256 supplied by the app server. Postgres never receives the plaintext 12-character recovery code or its server-only pepper.';

comment on column public.store_customer_claims.phone_e164 is
  'Self-reported store-scoped lookup/contact data. Never evidence of phone ownership and never copied into phone_verified during claim.';

comment on column public.store_customers.merged_into_store_customer_id is
  'Canonical relationship receiving all counters, purchases, and ledger ownership from this zeroed, removed merge tombstone.';

-- Migration-time policy assertions. These fail the migration rather than
-- allowing a partially hardened RPC surface to deploy.
do $$
declare
  v_public_rpc regprocedure;
begin
  foreach v_public_rpc in array array[
    'public.create_or_get_pending_store_customer(uuid,text,text,text,uuid,uuid,uuid)'::regprocedure,
    'public.issue_pending_store_customer_code(uuid,uuid,text,text,text,uuid,uuid,uuid)'::regprocedure,
    'public.confirm_pending_store_purchase(uuid,uuid,uuid,uuid,uuid,text)'::regprocedure,
    'public.claim_pending_store_customer(text,uuid,text)'::regprocedure,
    'public.confirm_store_purchase(uuid,uuid,uuid,uuid,uuid,uuid,text,text)'::regprocedure
  ]
  loop
    if exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_public_rpc
        and (
          p.prosecdef
          or p.proconfig is null
          or not p.proconfig @> array['search_path=""']::text[]
        )
    ) then
      raise exception 'Public loyalty RPC must be SECURITY INVOKER with an empty search_path: %',
        v_public_rpc;
    end if;

    if pg_catalog.has_function_privilege('anon', v_public_rpc, 'execute')
       or pg_catalog.has_function_privilege(
         'authenticated',
         v_public_rpc,
         'execute'
       )
       or not pg_catalog.has_function_privilege(
         'service_role',
         v_public_rpc,
         'execute'
       ) then
      raise exception 'Unexpected loyalty RPC execute grants: %', v_public_rpc;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = 'private.has_confirmed_email(uuid)'::regprocedure
      and p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'Email confirmation helper is not narrowly hardened';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'private.has_confirmed_email(uuid)'::regprocedure,
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'private.has_confirmed_email(uuid)'::regprocedure,
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'private.has_confirmed_email(uuid)'::regprocedure,
       'execute'
     ) then
    raise exception 'Unexpected email confirmation helper execute grants';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid =
      'private.is_valid_store_operator(uuid,uuid,uuid,uuid)'::regprocedure
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  )
  or pg_catalog.has_function_privilege(
    'anon',
    'private.is_valid_store_operator(uuid,uuid,uuid,uuid)'::regprocedure,
    'execute'
  )
  or pg_catalog.has_function_privilege(
    'authenticated',
    'private.is_valid_store_operator(uuid,uuid,uuid,uuid)'::regprocedure,
    'execute'
  )
  or not pg_catalog.has_function_privilege(
    'service_role',
    'private.is_valid_store_operator(uuid,uuid,uuid,uuid)'::regprocedure,
    'execute'
  ) then
    raise exception 'Unexpected store operator helper security';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'store_customers',
        'store_customer_claims',
        'store_purchases',
        'reward_ledger'
      )
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'Loyalty tables must have forced RLS';
  end if;

  if pg_catalog.has_table_privilege(
       'anon',
       'public.store_customer_claims',
       'select'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.store_customer_claims',
       'select'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.store_customer_claims',
       'insert'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.store_customer_claims',
       'update'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.store_customer_claims',
       'delete'
     ) then
    raise exception 'Pending claim table is exposed to an API role';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.reward_ledger'::regclass
      and a.attname = 'user_id'
      and a.attnotnull
  ) then
    raise exception 'Pending reward ledger ownership must be nullable';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conname in (
      'reward_ledger_user_id_fkey',
      'store_customer_claims_relationship_store_fkey',
      'store_customer_claims_claimed_target_store_fkey',
      'store_purchases_relationship_store_fkey',
      'store_purchases_pending_origin_store_fkey',
      'store_purchases_pending_origin_shape',
      'reward_ledger_purchase_store_fkey',
      'store_customers_merge_target_store_fkey',
      'store_customers_merge_tombstone_shape'
    )
      and not c.convalidated
  ) then
    raise exception 'A pending rewards constraint was not validated';
  end if;
end;
$$;
