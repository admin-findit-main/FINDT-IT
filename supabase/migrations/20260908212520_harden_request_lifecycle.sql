-- Make request responses and customer lifecycle transitions atomic, remove
-- direct customer UPDATE access, and sweep logically expired requests.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Store response: one service-role transaction owns response, target timing,
-- and request status.
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_store_request(
  p_request_id uuid,
  p_store_id uuid,
  p_response_type public.response_type,
  p_employee_user_id uuid default null,
  p_shift_employee_id uuid default null,
  p_hub_device_id uuid default null,
  p_price numeric default null,
  p_quantity integer default null,
  p_note text default null,
  p_hold_minutes integer default null,
  p_estimated_available_at timestamptz default null,
  p_estimated_availability_label text default null,
  p_availability_amount text default null,
  p_track_demand boolean default false
)
returns table (
  response_id uuid,
  request_id uuid,
  store_id uuid,
  responded_by uuid,
  response_type public.response_type,
  price numeric,
  quantity integer,
  note text,
  hold_minutes integer,
  estimated_available_at timestamptz,
  estimated_availability_label text,
  availability_amount text,
  track_demand boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_new boolean,
  notify_customer boolean,
  final_request_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request public.customer_requests%rowtype;
  v_target public.request_targets%rowtype;
  v_existing public.store_responses%rowtype;
  v_response public.store_responses%rowtype;
  v_responded_by uuid;
  v_target_count integer;
  v_response_count integer;
  v_final_status text;
  v_created_new boolean;
  v_notify_customer boolean;
begin
  if p_request_id is null
     or p_store_id is null
     or p_response_type is null then
    raise exception 'Invalid response operation';
  end if;

  if p_price is not null
     and (p_price < 0 or p_price > 99999999.99) then
    raise exception 'Invalid response operation';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'Invalid response operation';
  end if;

  if p_hold_minutes is not null
     and (p_hold_minutes < -1 or p_hold_minutes > 10080) then
    raise exception 'Invalid response operation';
  end if;

  if p_availability_amount is not null
     and p_availability_amount not in ('plenty', 'few_left', 'last_one') then
    raise exception 'Invalid response operation';
  end if;

  if p_note is not null and pg_catalog.char_length(p_note) > 2000 then
    raise exception 'Invalid response operation';
  end if;

  if p_estimated_availability_label is not null
     and pg_catalog.char_length(p_estimated_availability_label) > 200 then
    raise exception 'Invalid response operation';
  end if;

  select r.*
  into v_request
  from public.customer_requests as r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Request is not available';
  end if;

  if v_request.status not in ('active', 'partially_answered', 'answered') then
    raise exception 'Request is not accepting responses';
  end if;

  if v_request.expires_at <= v_now then
    raise exception 'Request has expired';
  end if;

  if not exists (
    select 1
    from public.stores as s
    where s.id = p_store_id
      and s.is_active = true
      and s.is_suspended = false
  ) then
    raise exception 'Invalid store response operation';
  end if;

  if not private.is_valid_store_operator(
    p_store_id,
    p_employee_user_id,
    p_shift_employee_id,
    p_hub_device_id
  ) then
    raise exception 'Invalid store response operation';
  end if;

  select rt.*
  into v_target
  from public.request_targets as rt
  where rt.request_id = p_request_id
    and rt.store_id = p_store_id
  for update;

  if not found then
    raise exception 'Request was not targeted to this store';
  end if;

  if v_target.delivery_status not in ('sent', 'delivered') then
    raise exception 'Request was not delivered to this store';
  end if;

  select sr.*
  into v_existing
  from public.store_responses as sr
  where sr.request_id = p_request_id
    and sr.store_id = p_store_id;

  if v_target.relevant = false
     and (
       v_existing.id is null
       or v_existing.response_type <> 'not_relevant'::public.response_type
       or p_response_type <> 'not_relevant'::public.response_type
     ) then
    raise exception 'Request target is not relevant to this store';
  end if;

  select coalesce(
    p_employee_user_id,
    (
      select d.paired_by
      from public.store_devices as d
      where d.id = p_hub_device_id
        and d.store_id = p_store_id
        and d.revoked_at is null
    ),
    s.owner_id
  )
  into v_responded_by
  from public.stores as s
  where s.id = p_store_id;

  if v_responded_by is null
     or not exists (
       select 1
       from public.profiles as p
       where p.id = v_responded_by
     ) then
    raise exception 'Invalid response actor';
  end if;

  v_created_new := v_existing.id is null;
  v_notify_customer :=
    p_response_type in (
      'in_stock'::public.response_type,
      'can_order'::public.response_type
    )
    and (
      v_created_new
      or v_existing.response_type is distinct from p_response_type
    );

  insert into public.store_responses as sr (
    request_id,
    store_id,
    responded_by,
    response_type,
    price,
    quantity,
    note,
    hold_minutes,
    estimated_available_at,
    estimated_availability_label,
    availability_amount,
    track_demand,
    created_at,
    updated_at
  )
  values (
    p_request_id,
    p_store_id,
    v_responded_by,
    p_response_type,
    p_price,
    p_quantity,
    nullif(pg_catalog.btrim(p_note), ''),
    p_hold_minutes,
    p_estimated_available_at,
    nullif(pg_catalog.btrim(p_estimated_availability_label), ''),
    p_availability_amount,
    coalesce(p_track_demand, false),
    v_now,
    v_now
  )
  on conflict on constraint store_responses_request_id_store_id_key
  do update set
    responded_by = excluded.responded_by,
    response_type = excluded.response_type,
    price = excluded.price,
    quantity = excluded.quantity,
    note = excluded.note,
    hold_minutes = excluded.hold_minutes,
    estimated_available_at = excluded.estimated_available_at,
    estimated_availability_label = excluded.estimated_availability_label,
    availability_amount = excluded.availability_amount,
    track_demand = excluded.track_demand,
    updated_at = excluded.updated_at
  returning sr.* into v_response;

  update public.request_targets as rt
  set
    responded_at = coalesce(rt.responded_at, v_now),
    response_time_seconds = coalesce(
      rt.response_time_seconds,
      greatest(
        0,
        pg_catalog.round(
          extract(
            epoch from (v_now - coalesce(rt.route_sent_at, rt.created_at))
          )
        )::integer
      )
    ),
    opened_at = coalesce(rt.opened_at, v_now),
    viewed_at = coalesce(rt.viewed_at, v_now),
    relevant = p_response_type <> 'not_relevant'::public.response_type
  where rt.id = v_target.id;

  select pg_catalog.count(*)::integer
  into v_target_count
  from public.request_targets as rt
  where rt.request_id = p_request_id;

  select pg_catalog.count(*)::integer
  into v_response_count
  from public.store_responses as sr
  where sr.request_id = p_request_id;

  v_final_status := case
    when v_response_count <= 0 then 'active'
    when v_target_count > 0 and v_response_count >= v_target_count then 'answered'
    else 'partially_answered'
  end;

  update public.customer_requests as r
  set
    status = v_final_status,
    stores_targeted = v_target_count
  where r.id = p_request_id
    and r.status in ('active', 'partially_answered', 'answered')
  returning r.status into v_final_status;

  if not found then
    select r.status
    into v_final_status
    from public.customer_requests as r
    where r.id = p_request_id;
  end if;

  return query
  select
    v_response.id,
    v_response.request_id,
    v_response.store_id,
    v_response.responded_by,
    v_response.response_type,
    v_response.price,
    v_response.quantity,
    v_response.note,
    v_response.hold_minutes,
    v_response.estimated_available_at,
    v_response.estimated_availability_label,
    v_response.availability_amount,
    v_response.track_demand,
    v_response.created_at,
    v_response.updated_at,
    v_created_new,
    v_notify_customer,
    v_final_status;
end;
$$;

revoke all on function public.respond_to_store_request(
  uuid,
  uuid,
  public.response_type,
  uuid,
  uuid,
  uuid,
  numeric,
  integer,
  text,
  integer,
  timestamptz,
  text,
  text,
  boolean
) from public, anon, authenticated;
grant execute on function public.respond_to_store_request(
  uuid,
  uuid,
  public.response_type,
  uuid,
  uuid,
  uuid,
  numeric,
  integer,
  text,
  integer,
  timestamptz,
  text,
  text,
  boolean
) to service_role;

comment on function public.respond_to_store_request(
  uuid,
  uuid,
  public.response_type,
  uuid,
  uuid,
  uuid,
  numeric,
  integer,
  text,
  integer,
  timestamptz,
  text,
  text,
  boolean
) is
  'Service-role-only atomic store response. Validates the operator and target, preserves first-response timestamps, derives counts from canonical rows, and emits an idempotent notification signal.';

-- ---------------------------------------------------------------------------
-- Customer lifecycle: narrowly privileged SECURITY DEFINER RPCs replace
-- arbitrary direct request updates.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_customer_request(
  p_request_id uuid
)
returns table (
  success boolean,
  request_id uuid,
  status text,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request public.customer_requests%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select r.*
  into v_request
  from public.customer_requests as r
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Request is not available';
  end if;

  if v_request.status not in (
    'draft',
    'active',
    'partially_answered',
    'answered'
  ) then
    raise exception 'Request cannot be cancelled';
  end if;

  if v_request.expires_at <= v_now then
    raise exception 'Request has expired';
  end if;

  update public.customer_requests as r
  set status = 'cancelled'
  where r.id = v_request.id
  returning r.* into v_request;

  return query
  select true, v_request.id, v_request.status, v_request.expires_at,
    v_request.updated_at;
end;
$$;

create or replace function public.fulfill_customer_request(
  p_request_id uuid,
  p_store_id uuid default null,
  p_found_with_findit boolean default null
)
returns table (
  success boolean,
  request_id uuid,
  status text,
  fulfilled_at timestamptz,
  fulfilled_store_id uuid,
  found_with_findit boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request public.customer_requests%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select r.*
  into v_request
  from public.customer_requests as r
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Request is not available';
  end if;

  if v_request.status not in ('active', 'partially_answered', 'answered') then
    raise exception 'Request cannot be fulfilled';
  end if;

  if v_request.expires_at <= v_now then
    raise exception 'Request has expired';
  end if;

  if p_store_id is not null
     and not exists (
       select 1
       from public.request_targets as rt
       join public.store_responses as sr
         on sr.request_id = rt.request_id
        and sr.store_id = rt.store_id
       where rt.request_id = v_request.id
         and rt.store_id = p_store_id
         and sr.response_type in (
           'in_stock'::public.response_type,
           'can_order'::public.response_type
         )
     ) then
    raise exception 'Selected store did not provide an eligible response';
  end if;

  update public.customer_requests as r
  set
    status = 'fulfilled',
    fulfilled_at = v_now,
    fulfilled_store_id = p_store_id,
    found_with_findit = p_found_with_findit
  where r.id = v_request.id
  returning r.* into v_request;

  return query
  select true, v_request.id, v_request.status, v_request.fulfilled_at,
    v_request.fulfilled_store_id, v_request.found_with_findit,
    v_request.updated_at;
end;
$$;

create or replace function public.rebroadcast_customer_request(
  p_request_id uuid
)
returns table (
  success boolean,
  request_id uuid,
  status text,
  still_looking_count integer,
  last_rebroadcast_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request public.customer_requests%rowtype;
  v_extended_expiry timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select r.*
  into v_request
  from public.customer_requests as r
  where r.id = p_request_id
    and r.customer_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Request is not available';
  end if;

  if v_request.status not in ('active', 'partially_answered', 'answered') then
    raise exception 'Request cannot be rebroadcast';
  end if;

  if v_request.expires_at <= v_now then
    raise exception 'Request has expired';
  end if;

  if v_request.still_looking_count >= 2 then
    raise exception 'Request has reached its rebroadcast limit';
  end if;

  if v_request.last_rebroadcast_at is not null
     and v_request.last_rebroadcast_at + interval '4 hours' > v_now then
    raise exception 'Request is in its rebroadcast cooldown';
  end if;

  v_extended_expiry := least(
    greatest(v_request.expires_at, v_now) + interval '12 hours',
    v_request.created_at + interval '48 hours'
  );

  if v_extended_expiry <= v_request.expires_at then
    raise exception 'Request cannot be extended further';
  end if;

  update public.customer_requests as r
  set
    still_looking_count = r.still_looking_count + 1,
    last_rebroadcast_at = v_now,
    expires_at = v_extended_expiry
  where r.id = v_request.id
  returning r.* into v_request;

  return query
  select true, v_request.id, v_request.status,
    v_request.still_looking_count, v_request.last_rebroadcast_at,
    v_request.expires_at, v_request.updated_at;
end;
$$;

revoke all on function public.cancel_customer_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.fulfill_customer_request(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.rebroadcast_customer_request(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.cancel_customer_request(uuid)
  to authenticated;
grant execute on function public.fulfill_customer_request(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.rebroadcast_customer_request(uuid)
  to authenticated;

comment on function public.cancel_customer_request(uuid) is
  'Authenticated owner-only request cancellation with row locking and lifecycle validation.';
comment on function public.fulfill_customer_request(uuid, uuid, boolean) is
  'Authenticated owner-only fulfillment with row locking and optional eligible-store validation.';
comment on function public.rebroadcast_customer_request(uuid) is
  'Authenticated owner-only still-looking transition with a two-use limit, four-hour cooldown, twelve-hour extension, and forty-eight-hour lifetime cap.';

drop policy if exists "requests_update_own" on public.customer_requests;
revoke update on table public.customer_requests
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Expiry reconciliation. The existing expires_at btree is retained: the live
-- table is small and EXPLAIN correctly chose a sequential scan, so another
-- partial index would add write cost without helping the current shape.
-- ---------------------------------------------------------------------------

create or replace function private.expire_open_customer_requests()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.customer_requests as r
  set status = 'expired'
  where r.status in ('draft', 'active', 'partially_answered', 'answered')
    and r.expires_at <= pg_catalog.clock_timestamp();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

revoke all on function private.expire_open_customer_requests()
  from public, anon, authenticated, service_role;

comment on function private.expire_open_customer_requests() is
  'Internal pg_cron reconciliation for logically expired open requests. Not exposed to API roles.';

-- Safe one-time reconciliation; this is rolled back if any assertion below
-- fails.
select private.expire_open_customer_requests();

select cron.unschedule(jobid)
from cron.job
where jobname = 'expire-open-customer-requests';

select cron.schedule(
  'expire-open-customer-requests',
  '*/5 * * * *',
  $cron$select private.expire_open_customer_requests();$cron$
);

-- ---------------------------------------------------------------------------
-- Migration-time contract assertions.
-- ---------------------------------------------------------------------------

do $$
declare
  v_respond_rpc regprocedure :=
    'public.respond_to_store_request(uuid,uuid,public.response_type,uuid,uuid,uuid,numeric,integer,text,integer,timestamptz,text,text,boolean)'::regprocedure;
  v_customer_rpc regprocedure;
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid = v_respond_rpc
      and not p.prosecdef
      and p.provolatile = 'v'
      and p.proconfig @> array['search_path=""']::text[]
      and p.proargnames[1:14] = array[
        'p_request_id',
        'p_store_id',
        'p_response_type',
        'p_employee_user_id',
        'p_shift_employee_id',
        'p_hub_device_id',
        'p_price',
        'p_quantity',
        'p_note',
        'p_hold_minutes',
        'p_estimated_available_at',
        'p_estimated_availability_label',
        'p_availability_amount',
        'p_track_demand'
      ]::text[]
      and p.proargnames[15:32] = array[
        'response_id',
        'request_id',
        'store_id',
        'responded_by',
        'response_type',
        'price',
        'quantity',
        'note',
        'hold_minutes',
        'estimated_available_at',
        'estimated_availability_label',
        'availability_amount',
        'track_demand',
        'created_at',
        'updated_at',
        'created_new',
        'notify_customer',
        'final_request_status'
      ]::text[]
  ) then
    raise exception 'Store response RPC signature or security is incorrect';
  end if;

  if pg_catalog.has_function_privilege('anon', v_respond_rpc, 'execute')
     or pg_catalog.has_function_privilege(
       'authenticated',
       v_respond_rpc,
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       v_respond_rpc,
       'execute'
     ) then
    raise exception 'Store response RPC grants are incorrect';
  end if;

  foreach v_customer_rpc in array array[
    'public.cancel_customer_request(uuid)'::regprocedure,
    'public.fulfill_customer_request(uuid,uuid,boolean)'::regprocedure,
    'public.rebroadcast_customer_request(uuid)'::regprocedure
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_roles as owner_role
        on owner_role.oid = p.proowner
      where p.oid = v_customer_rpc
        and p.prosecdef
        and p.provolatile = 'v'
        and p.proconfig @> array['search_path=""']::text[]
        and owner_role.rolbypassrls
        and p.proargnames[1:p.pronargs] = case p.proname
          when 'cancel_customer_request'
            then array['p_request_id']::text[]
          when 'fulfill_customer_request'
            then array[
              'p_request_id',
              'p_store_id',
              'p_found_with_findit'
            ]::text[]
          when 'rebroadcast_customer_request'
            then array['p_request_id']::text[]
        end
    ) then
      raise exception 'Customer lifecycle RPC is not narrowly hardened: %',
        v_customer_rpc;
    end if;

    if pg_catalog.has_function_privilege('anon', v_customer_rpc, 'execute')
       or not pg_catalog.has_function_privilege(
         'authenticated',
         v_customer_rpc,
         'execute'
       ) then
      raise exception 'Customer lifecycle RPC grants are incorrect: %',
        v_customer_rpc;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_policy as pol
    where pol.polrelid = 'public.customer_requests'::regclass
      and pol.polcmd = 'w'
  ) then
    raise exception 'A direct customer request UPDATE policy still exists';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated',
       'public.customer_requests',
       'update'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated',
       'public.customer_requests',
       'select'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated',
       'public.customer_requests',
       'insert'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.customer_requests',
       'update'
     ) then
    raise exception 'Customer request table grants are incorrect';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as c
    where c.oid in (
      'public.customer_requests'::regclass,
      'public.request_targets'::regclass,
      'public.store_responses'::regclass
    )
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'Request lifecycle tables must retain forced RLS';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy as pol
    where pol.polrelid = 'public.customer_requests'::regclass
      and pol.polcmd = 'r'
      and pol.polroles @> array['authenticated'::regrole]::oid[]
  ) then
    raise exception 'Customer request owner SELECT policy is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as c
    where c.conrelid = 'public.request_targets'::regclass
      and c.contype = 'u'
      and pg_catalog.pg_get_constraintdef(c.oid)
        = 'UNIQUE (request_id, store_id)'
  )
  or not exists (
    select 1
    from pg_catalog.pg_constraint as c
    where c.conrelid = 'public.store_responses'::regclass
      and c.contype = 'u'
      and pg_catalog.pg_get_constraintdef(c.oid)
        = 'UNIQUE (request_id, store_id)'
  ) then
    raise exception 'Canonical request target/response uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid =
      'private.expire_open_customer_requests()'::regprocedure
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  )
  or pg_catalog.has_function_privilege(
    'anon',
    'private.expire_open_customer_requests()'::regprocedure,
    'execute'
  )
  or pg_catalog.has_function_privilege(
    'authenticated',
    'private.expire_open_customer_requests()'::regprocedure,
    'execute'
  )
  or pg_catalog.has_function_privilege(
    'service_role',
    'private.expire_open_customer_requests()'::regprocedure,
    'execute'
  ) then
    raise exception 'Expired request sweep is exposed or misconfigured';
  end if;

  if (
    select pg_catalog.count(*)
    from cron.job as j
    where j.jobname = 'expire-open-customer-requests'
      and j.schedule = '*/5 * * * *'
      and j.command =
        'select private.expire_open_customer_requests();'
      and j.active
  ) <> 1 then
    raise exception 'Expired request cron registration is incorrect';
  end if;

  if exists (
    select 1
    from public.customer_requests as r
    where r.status in ('draft', 'active', 'partially_answered', 'answered')
      and r.expires_at <= pg_catalog.clock_timestamp()
  ) then
    raise exception 'Initial expired request sweep did not reconcile all rows';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_enum as e
    join pg_catalog.pg_type as t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'response_type'
    group by t.oid
    having pg_catalog.array_agg(e.enumlabel::text order by e.enumsortorder)
      @> array['in_stock', 'out_of_stock', 'can_order', 'not_relevant']
  ) then
    raise exception 'Required response type enum labels are missing';
  end if;
end;
$$;
