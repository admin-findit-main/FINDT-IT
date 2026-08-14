-- Pilot readiness: request categories on applications, applicant RLS, realtime

alter table public.store_applications
  add column if not exists request_categories text[] not null default '{}';

alter table public.store_applications
  add column if not exists created_store_id uuid references public.stores(id) on delete set null;

-- Applicants can read their own applications (by user id or email)
drop policy if exists "Applicants can read own store applications" on public.store_applications;
create policy "Applicants can read own store applications"
  on public.store_applications for select
  using (
    applicant_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt()->>'email', ''))
    or public.is_admin()
  );

-- Ensure realtime can publish core loop tables
do $$
begin
  begin
    alter publication supabase_realtime add table public.store_responses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.request_targets;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.customer_requests;
  exception when duplicate_object then null;
  end;
end $$;
