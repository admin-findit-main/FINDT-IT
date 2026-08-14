-- Fix infinite RLS recursion between customer_requests ↔ request_targets ↔ store_responses
-- Root cause: policies cross-select each other under RLS.

create or replace function public.customer_owns_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_requests cr
    where cr.id = p_request_id
      and cr.customer_id = auth.uid()
  );
$$;

create or replace function public.can_view_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.customer_requests cr
      where cr.id = p_request_id
        and cr.customer_id = auth.uid()
    )
    or exists (
      select 1
      from public.request_targets rt
      join public.store_members m
        on m.store_id = rt.store_id
       and m.user_id = auth.uid()
       and m.status = 'active'
      where rt.request_id = p_request_id
    );
$$;

create or replace function public.is_targeted_store_member(p_request_id uuid, p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_store_member(p_store_id)
    and exists (
      select 1
      from public.request_targets rt
      where rt.request_id = p_request_id
        and rt.store_id = p_store_id
    );
$$;

-- Replace recursive policies
drop policy if exists "requests_select" on public.customer_requests;
create policy "requests_select" on public.customer_requests
  for select using (public.can_view_request(id));

drop policy if exists "targets_select" on public.request_targets;
create policy "targets_select" on public.request_targets
  for select using (
    public.is_store_member(store_id)
    or public.is_admin()
    or public.customer_owns_request(request_id)
  );

drop policy if exists "targets_insert_service" on public.request_targets;
create policy "targets_insert_service" on public.request_targets
  for insert with check (
    public.is_admin()
    or public.customer_owns_request(request_id)
  );

drop policy if exists "responses_select" on public.store_responses;
create policy "responses_select" on public.store_responses
  for select using (
    public.is_store_member(store_id)
    or public.is_admin()
    or public.customer_owns_request(request_id)
  );

drop policy if exists "responses_insert_member" on public.store_responses;
create policy "responses_insert_member" on public.store_responses
  for insert with check (
    responded_by = auth.uid()
    and public.is_targeted_store_member(request_id, store_id)
  );

-- store_members_read also recurses via is_store_member calling store_members under RLS
-- is_store_member is already security definer; keep read policy simple for own rows
drop policy if exists "store_members_read" on public.store_members;
create policy "store_members_read" on public.store_members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.can_manage_store(store_id)
    or public.is_store_member(store_id)
  );

grant execute on function public.customer_owns_request(uuid) to authenticated, anon;
grant execute on function public.can_view_request(uuid) to authenticated, anon;
grant execute on function public.is_targeted_store_member(uuid, uuid) to authenticated, anon;
