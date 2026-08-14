-- Nuclear fix: request INSERT RLS + verify policies
-- Safe to re-run.

-- Show current policies (visible in SQL editor Results)
select
  policyname,
  cmd,
  roles,
  qual as using_expression,
  with_check
from pg_policies
where tablename = 'customer_requests'
order by cmd, policyname;

-- Recreate INSERT policy without role restriction quirks
drop policy if exists "requests_insert_own" on public.customer_requests;
create policy "requests_insert_own"
  on public.customer_requests
  for insert
  with check (
    auth.uid() is not null
    and customer_id = auth.uid()
  );

-- Ensure grants
grant select, insert, update on table public.customer_requests to authenticated;
grant select, insert, update on table public.customer_requests to service_role;

-- Confirm insert policy exists
select policyname, cmd, with_check
from pg_policies
where tablename = 'customer_requests' and cmd = 'INSERT';
