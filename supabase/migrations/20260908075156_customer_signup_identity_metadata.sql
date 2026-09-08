-- Bootstrap self-reported customer signup identity from email-OTP metadata.
-- A collected phone is contact data only; it is never considered verified.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.account_type;
  phone_norm text;
  display text;
begin
  acct := coalesce(
    (new.raw_user_meta_data->>'account_type')::public.account_type,
    'customer'
  );
  if acct = 'admin' then
    acct := 'customer';
  end if;
  if lower(coalesce(new.email, '')) = 'ali@askfindit.com' then
    acct := 'admin';
  end if;

  phone_norm := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'phone_e164',
        new.phone,
        ''
      )
    ),
    ''
  );
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
    phone_verified,
    phone_verified_at,
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
    false,
    null,
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
