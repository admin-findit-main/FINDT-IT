-- Admin broadcast log + sole operator is ali@askfindit.com.

create table if not exists public.admin_push_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null references auth.users(id) on delete restrict,
  audience text not null
    check (audience in ('all', 'shoppers', 'store_owners', 'employees')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 280),
  destination_url text not null check (char_length(destination_url) between 1 and 500),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  pruned_count integer not null default 0 check (pruned_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists admin_push_broadcasts_created_idx
  on public.admin_push_broadcasts (created_at desc);

create index if not exists admin_push_broadcasts_sent_by_idx
  on public.admin_push_broadcasts (sent_by);

alter table public.admin_push_broadcasts enable row level security;
alter table public.admin_push_broadcasts force row level security;

revoke all on public.admin_push_broadcasts from public, anon, authenticated;
grant select, insert on public.admin_push_broadcasts to authenticated;
grant all on public.admin_push_broadcasts to service_role;

drop policy if exists "admin_push_broadcasts_select_admin" on public.admin_push_broadcasts;
create policy "admin_push_broadcasts_select_admin"
  on public.admin_push_broadcasts
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "admin_push_broadcasts_insert_admin" on public.admin_push_broadcasts;
create policy "admin_push_broadcasts_insert_admin"
  on public.admin_push_broadcasts
  for insert
  to authenticated
  with check ((select public.is_admin()) and sent_by = (select auth.uid()));

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
      and lower(p.email) = 'ali@askfindit.com'
  );
$$;

create or replace function public.enforce_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'ali@askfindit.com' then
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
  if lower(coalesce(new.email, '')) = 'ali@askfindit.com' then
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
  and lower(email) is distinct from 'ali@askfindit.com';

update public.profiles
set account_type = 'admin'
where lower(email) = 'ali@askfindit.com'
  and is_suspended = false;
