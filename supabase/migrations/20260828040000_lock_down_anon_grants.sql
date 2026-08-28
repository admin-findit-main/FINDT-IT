-- Tighten Data API grants: anon is not granted everything by default.
-- RLS stays on (and forced) for every public table. Authenticated keeps
-- row-filtered DML. Catalog + live store directory stay publicly readable.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

grant usage on schema public to anon, authenticated, service_role;

-- Public read: catalog + approved store directory (RLS still filters rows).
grant select on
  public.catalog_business_types,
  public.catalog_categories,
  public.catalog_subcategories,
  public.catalog_keywords,
  public.prohibited_terms,
  public.stores,
  public.store_hours,
  public.store_categories,
  public.store_catalog_categories,
  public.store_catalog_subcategories,
  public.store_catalog_keywords,
  public.store_service_areas
to anon;

-- Join is submitted by the Next.js server with the service role. Anon does
-- not insert applications directly.

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

revoke all on public.rate_limit_buckets from anon, authenticated;
grant all on public.rate_limit_buckets to service_role;

grant usage, select on all sequences in schema public
  to authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('alter table public.%I force row level security', r.relname);
  end loop;
end
$$;
