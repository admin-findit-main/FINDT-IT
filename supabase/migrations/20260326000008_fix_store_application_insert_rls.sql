-- Fix store_applications join-form RLS (INSERT + RETURNING)
-- Anonymous /join users could insert but failed SELECT on returning the row.

grant select, insert on public.store_applications to anon, authenticated;
grant update on public.store_applications to authenticated;

drop policy if exists "Anyone can submit store applications" on public.store_applications;
create policy "Anyone can submit store applications"
  on public.store_applications for insert
  to anon, authenticated
  with check (confirmed_legitimate = true);

-- Keep applicant + admin SELECT policies from earlier migrations.
-- App submit uses service role during pilot so RETURNING always works.
