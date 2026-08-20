-- New Supabase projects do not auto-expose public tables to the Data API.
-- RLS still decides which rows each role can see; these GRANTs only make
-- tables visible to PostgREST. Keep enforce_monthly_find_cap private.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

grant select on all tables in schema public to anon;
grant insert on public.store_applications to anon;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public to authenticated, service_role;

revoke all on function public.enforce_monthly_find_cap() from public, anon, authenticated;
revoke all on function public.enforce_solo_admin() from public, anon, authenticated;
revoke all on function public.protect_profile_locked_fields() from public, anon, authenticated;
revoke all on function public.protect_profile_phone() from public, anon, authenticated;

-- Signup as stirux.invest@gmail.com becomes the operator admin (metadata cannot).
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
  if lower(coalesce(new.email, '')) = 'stirux.invest@gmail.com' then
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
