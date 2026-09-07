-- Pin search_path on the three functions that lacked it, and stop exposing the
-- RLS event-trigger helper as a callable API.
--
-- Deliberately NOT included: revoking EXECUTE from anon on is_admin,
-- is_store_member, store_role, can_manage_store, customer_owns_request,
-- can_view_request and is_targeted_store_member. The security advisor flags all
-- seven, but every one is called from RLS policies whose role list is `public`,
-- which includes anon -- `stores_public_read_active` reaches is_store_member()
-- and is_admin() for anonymous visitors browsing a store page, and
-- `requests_select` reaches can_view_request(). Policy expressions are
-- evaluated as the querying role, so revoking EXECUTE turns those reads into
-- "permission denied for function" instead of denying a row. Worse, because the
-- helpers sit in OR branches the failure depends on which rows are scanned, so
-- it would surface intermittently.
--
-- These functions only return booleans about the caller, so exposure is
-- limited. The real fix is to move them to a schema PostgREST does not expose
-- and qualify the policy references, which touches ~60 policies and belongs in
-- its own change.

-- Runs only from the `ensure_rls` event trigger, which the system invokes
-- without consulting EXECUTE grants. It also returns `event_trigger` and calls
-- pg_event_trigger_ddl_commands(), so a direct RPC call could never work --
-- it was reachable at /rest/v1/rpc/rls_auto_enable for no benefit.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

-- Empty search_path: both reference only pg_catalog builtins (now(), trim(),
-- regexp_replace(), lower(), coalesce()), which resolve without it.
alter function public.set_updated_at() set search_path = '';
alter function public.normalize_product_name(text) set search_path = '';

-- This one assigns enum-typed columns and reads auth.jwt(). The jwt call is
-- already schema-qualified, but public stays on the path so the enum literals
-- resolve exactly as they did before -- pinning the order is what closes the
-- shadowing hole, and there is no reason to risk a billing-protection trigger
-- to also shorten the list.
alter function public.protect_subscription_billing_fields()
  set search_path = pg_catalog, public;
