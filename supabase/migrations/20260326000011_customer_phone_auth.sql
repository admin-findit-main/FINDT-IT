-- Customer phone OTP auth: nullable email, E.164 phone on profiles.
-- Store/admin accounts keep email/password. Do not reset existing users.

alter table public.profiles
  alter column email drop not null;

alter table public.profiles
  add column if not exists phone_e164 text;

alter table public.profiles
  drop constraint if exists profiles_phone_e164_format;

alter table public.profiles
  add constraint profiles_phone_e164_format
  check (
    phone_e164 is null
    or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  );

create unique index if not exists profiles_phone_e164_key
  on public.profiles (phone_e164)
  where phone_e164 is not null;

comment on column public.profiles.phone_e164 is
  'Customer auth phone in E.164. Never expose to stores.';

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

-- Authenticated users cannot change their own auth phone via profiles UPDATE.
create or replace function public.protect_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and new.phone_e164 is distinct from old.phone_e164 then
    raise exception 'Phone number cannot be changed from the profile form';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_phone on public.profiles;
create trigger profiles_protect_phone
  before update of phone_e164
  on public.profiles
  for each row
  execute function public.protect_profile_phone();

revoke all on function public.protect_profile_phone() from public, anon, authenticated;
