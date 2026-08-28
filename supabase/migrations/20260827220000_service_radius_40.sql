-- Allow 40-mile store service radius to match customer search options.

alter table public.stores
  drop constraint if exists stores_service_radius_miles_check;

alter table public.stores
  add constraint stores_service_radius_miles_check
  check (service_radius_miles in (2, 5, 10, 15, 25, 40));
