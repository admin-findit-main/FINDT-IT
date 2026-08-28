-- Legal identity for store applications and approved stores.
-- EIN is 9 digits, stored without a dash. Customers never see this.

alter table public.store_applications
  add column if not exists legal_name text,
  add column if not exists ein text,
  add column if not exists entity_type text;

alter table public.stores
  add column if not exists legal_name text,
  add column if not exists ein text,
  add column if not exists entity_type text;

alter table public.store_applications
  drop constraint if exists store_applications_ein_format;
alter table public.store_applications
  add constraint store_applications_ein_format
  check (ein is null or ein ~ '^[0-9]{9}$');

alter table public.stores
  drop constraint if exists stores_ein_format;
alter table public.stores
  add constraint stores_ein_format
  check (ein is null or ein ~ '^[0-9]{9}$');

create index if not exists store_applications_ein_idx
  on public.store_applications (ein)
  where ein is not null;

comment on column public.store_applications.ein is
  'US Employer Identification Number, 9 digits, no dash.';
comment on column public.stores.ein is
  'US Employer Identification Number copied from the approved application.';
