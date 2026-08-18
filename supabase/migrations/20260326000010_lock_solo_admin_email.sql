-- FINDIT allows exactly one operator admin: stirux.invest@gmail.com.
-- RLS helpers (is_admin) and a profiles trigger enforce this at the database.

update public.profiles
set account_type = case
  when exists (
    select 1
    from public.store_members sm
    where sm.user_id = profiles.id
      and sm.status = 'active'
  ) then 'business'::account_type
  else 'customer'::account_type
end
where account_type = 'admin'
  and lower(email) is distinct from 'stirux.invest@gmail.com';

update public.profiles
set account_type = 'admin'
where lower(email) = 'stirux.invest@gmail.com'
  and is_suspended = false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'admin'
      and p.is_suspended = false
      and lower(p.email) = 'stirux.invest@gmail.com'
  );
$$;

create or replace function public.enforce_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type = 'admin'
     and lower(coalesce(new.email, '')) <> 'stirux.invest@gmail.com' then
    raise exception 'Only the designated FINDIT operator can be admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_solo_admin on public.profiles;
create trigger profiles_enforce_solo_admin
  before insert or update of account_type, email
  on public.profiles
  for each row
  execute function public.enforce_solo_admin();

revoke all on function public.enforce_solo_admin() from public, anon, authenticated;
