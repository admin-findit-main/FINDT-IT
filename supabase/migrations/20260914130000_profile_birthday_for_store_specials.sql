-- Shopper birthday for store birthday specials (opt-in share only).
-- Month/day are enough for specials; year is optional for age-aware offers later.

alter table public.profiles
  add column if not exists birth_month smallint,
  add column if not exists birth_day smallint,
  add column if not exists birth_year smallint,
  add column if not exists share_birthday_with_stores boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_month_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_month_range
      check (birth_month is null or birth_month between 1 and 12);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_day_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_day_range
      check (birth_day is null or birth_day between 1 and 31);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_year_range'
  ) then
    alter table public.profiles
      add constraint profiles_birth_year_range
      check (birth_year is null or birth_year between 1900 and 2100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_complete'
  ) then
    alter table public.profiles
      add constraint profiles_birth_complete
      check (
        (birth_month is null and birth_day is null)
        or (birth_month is not null and birth_day is not null)
      );
  end if;
end
$$;

comment on column public.profiles.birth_month is
  'Optional birthday month (1-12). Shared with stores only when share_birthday_with_stores is true.';
comment on column public.profiles.birth_day is
  'Optional birthday day (1-31). Shared with stores only when share_birthday_with_stores is true.';
comment on column public.profiles.birth_year is
  'Optional birth year. Never required for birthday specials; stores see month/day only when shared.';
comment on column public.profiles.share_birthday_with_stores is
  'When true, stores where this shopper has a store_customers row may see month/day for birthday specials.';

create index if not exists profiles_birthday_share_idx
  on public.profiles (birth_month, birth_day)
  where share_birthday_with_stores = true
    and birth_month is not null
    and birth_day is not null;
