-- Customer visual themes (profile-scoped). Default for everyone; assign privately via DB/admin.
-- theme_id is locked from client self-service updates (same pattern as plan/suspension).

alter table public.profiles
  add column if not exists theme_id text not null default 'default';

alter table public.profiles
  drop constraint if exists profiles_theme_id_check;

alter table public.profiles
  add constraint profiles_theme_id_check
  check (theme_id in ('default', 'pooh', 'dark', 'seasonal', 'custom'));

comment on column public.profiles.theme_id is
  'Customer UI theme id. Assigned internally only; clients may read their own row via existing RLS.';

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
       or new.phone_verified_at is distinct from old.phone_verified_at
       or new.theme_id is distinct from old.theme_id then
      raise exception 'Account role, plan, theme, and verified contact fields cannot be changed from the client';
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
    phone_verified_at,
    theme_id
  on public.profiles
  for each row
  execute function public.protect_profile_locked_fields();

revoke all on function public.protect_profile_locked_fields()
  from public, anon, authenticated;

-- One-time assignment by profile id (looked up from auth email outside this file).
update public.profiles
set theme_id = 'pooh'
where id = 'e07a0c61-883c-4eb9-b545-54b3e4a2fe26';
