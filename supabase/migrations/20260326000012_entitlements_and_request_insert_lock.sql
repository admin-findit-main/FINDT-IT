-- Lock consumer plan / role fields from client updates.
-- Request creation and store assignment must go through trusted server paths
-- (Next.js actions / Edge Functions using the service role), which re-check entitlements.

create or replace function public.protect_profile_locked_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.account_type is distinct from old.account_type
       or new.subscription_plan is distinct from old.subscription_plan
       or new.is_suspended is distinct from old.is_suspended
       or new.phone_e164 is distinct from old.phone_e164 then
      raise exception 'Account role and plan cannot be changed from the client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_phone on public.profiles;
drop trigger if exists profiles_protect_locked_fields on public.profiles;
create trigger profiles_protect_locked_fields
  before update of account_type, subscription_plan, is_suspended, phone_e164
  on public.profiles
  for each row
  execute function public.protect_profile_locked_fields();

revoke all on function public.protect_profile_locked_fields() from public, anon, authenticated;

-- Authenticated clients cannot insert Finds or assignments.
-- Service role (used by createCustomerRequestAction / create-and-route-request) bypasses RLS.
drop policy if exists "requests_insert_own" on public.customer_requests;
drop policy if exists "targets_insert_service" on public.request_targets;
