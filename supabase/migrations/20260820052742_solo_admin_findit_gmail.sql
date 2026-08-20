-- The only operator admin is admin.findit@gmail.com.
-- Replace functions first so the following UPDATEs pass enforce_solo_admin.

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
      and lower(p.email) = 'admin.findit@gmail.com'
  );
$$;

create or replace function public.enforce_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'admin.findit@gmail.com' then
    new.account_type := 'admin';
  elsif new.account_type = 'admin' then
    raise exception 'Only the designated FINDIT operator can be admin';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acct account_type;
  phone_norm text;
  display text;
begin
  acct := coalesce((new.raw_user_meta_data->>'account_type')::account_type, 'customer');
  if acct = 'admin' then
    acct := 'customer';
  end if;
  if lower(coalesce(new.email, '')) = 'admin.findit@gmail.com' then
    acct := 'admin';
  end if;

  phone_norm := nullif(trim(coalesce(new.phone, '')), '');
  if phone_norm is not null and left(phone_norm, 1) <> '+' then
    phone_norm := '+' || phone_norm;
  end if;
  if phone_norm is not null and phone_norm !~ '^\+[1-9][0-9]{7,14}$' then
    phone_norm := null;
  end if;

  display := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    case
      when new.email is not null and strpos(new.email, '@') > 1
        then split_part(new.email, '@', 1)
      else 'Customer'
    end
  );

  insert into public.profiles (
    id,
    email,
    phone_e164,
    first_name,
    last_name,
    display_name,
    account_type,
    default_city,
    default_state,
    default_postal_code
  )
  values (
    new.id,
    nullif(trim(coalesce(new.email, '')), ''),
    phone_norm,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    display,
    acct,
    new.raw_user_meta_data->>'default_city',
    coalesce(new.raw_user_meta_data->>'default_state', 'VA'),
    new.raw_user_meta_data->>'default_postal_code'
  );
  return new;
end;
$$;

revoke all on function public.enforce_solo_admin() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

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
  and lower(email) is distinct from 'admin.findit@gmail.com';

update public.profiles
set account_type = 'admin'
where lower(email) = 'admin.findit@gmail.com'
  and is_suspended = false;
