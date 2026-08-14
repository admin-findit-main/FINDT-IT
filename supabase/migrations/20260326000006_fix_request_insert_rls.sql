-- Ensure customers can create their own requests (INSERT policy was missing/broken on some applies)

drop policy if exists "requests_insert_own" on public.customer_requests;
create policy "requests_insert_own" on public.customer_requests
  for insert to authenticated
  with check (customer_id = auth.uid());

drop policy if exists "requests_update_own" on public.customer_requests;
create policy "requests_update_own" on public.customer_requests
  for update to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

grant select, insert, update on public.customer_requests to authenticated;
grant select, insert, update on public.request_targets to authenticated;
grant select, insert, update on public.store_responses to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, delete on public.saved_requests to authenticated;
