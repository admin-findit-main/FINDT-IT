-- Optional public store logo for branded customer alerts.
alter table public.stores
  add column if not exists logo_url text;

comment on column public.stores.logo_url is
  'Optional public HTTPS URL for the store mark shown on customer notifications. Never required.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_logo_url_https'
  ) then
    alter table public.stores
      add constraint stores_logo_url_https
      check (
        logo_url is null
        or (
          char_length(logo_url) between 12 and 500
          and logo_url ~* '^https://'
        )
      );
  end if;
end
$$;
