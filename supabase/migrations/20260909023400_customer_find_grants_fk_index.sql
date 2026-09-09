-- Cover the optional audit-actor foreign key for profile deletion and joins.
create index customer_find_grants_granted_by_idx
  on public.customer_find_grants (granted_by)
  where granted_by is not null;
