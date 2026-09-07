-- Close authorization/privacy gaps found during the role audit.

-- Store creation is an admin provisioning operation after application
-- approval. Authenticated users must not be able to publish an active store
-- through the Data API.
drop policy if exists "stores_insert_owner" on public.stores;
revoke insert on public.stores from authenticated;

-- Store clients receive a privacy-shaped DTO from trusted server endpoints.
-- Direct request-row reads remain available only to the owning shopper and
-- the sole admin.
drop policy if exists "requests_select" on public.customer_requests;
create policy "requests_select" on public.customer_requests
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or public.is_admin()
  );

revoke all on function public.can_view_request(uuid)
  from public, anon, authenticated;
drop function public.can_view_request(uuid);

-- Request photos are private. The service layer issues short-lived signed
-- URLs only after shopper ownership, store membership, or Hub authorization.
update storage.buckets
set public = false
where id in ('request-images', 'product-images');

drop policy if exists "Public read request images" on storage.objects;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.can_read_request_image(
  p_bucket text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and p_bucket in ('request-images', 'product-images')
    and exists (
      select 1
      from public.customer_requests r
      join public.request_targets rt
        on rt.request_id = r.id
      join public.store_members sm
        on sm.store_id = rt.store_id
       and sm.user_id = (select auth.uid())
       and sm.status = 'active'
      where
        r.image_storage_path = p_name
        or r.image_url = p_name
        or r.image_url like '%/' || p_bucket || '/' || p_name || '%'
    );
$$;

revoke all on function private.can_read_request_image(text, text)
  from public, anon, authenticated;
grant execute on function private.can_read_request_image(text, text)
  to authenticated;

drop policy if exists "Authorized read request images" on storage.objects;
create policy "Authorized read request images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('request-images', 'product-images')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.can_read_request_image(bucket_id, name)
    )
  );

-- Convert current request-images public URLs into object paths. Keep legacy
-- product-images URLs intact so the signing helper can identify their bucket.
update public.customer_requests
set
  image_storage_path = coalesce(
    image_storage_path,
    split_part(split_part(image_url, '/request-images/', 2), '?', 1)
  ),
  image_url = coalesce(
    image_storage_path,
    split_part(split_part(image_url, '/request-images/', 2), '?', 1)
  )
where image_url like '%/request-images/%';

update public.customer_requests
set image_url = image_storage_path
where image_storage_path is not null
  and (
    image_url is null
    or image_url like '%/request-images/%'
  );
