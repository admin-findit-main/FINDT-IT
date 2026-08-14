-- FINDIT Pilot v1: lifecycle, routing metadata, storage, feedback, coverage

-- ---------------------------------------------------------------------------
-- Request lifecycle + customer success
-- ---------------------------------------------------------------------------
alter table public.customer_requests
  drop constraint if exists customer_requests_status_check;

alter table public.customer_requests
  add constraint customer_requests_status_check
  check (status in (
    'draft',
    'active',
    'partially_answered',
    'answered',
    'fulfilled',
    'expired',
    'cancelled'
  ));

alter table public.customer_requests
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfilled_store_id uuid references public.stores(id) on delete set null,
  add column if not exists found_with_findit boolean,
  add column if not exists still_looking_count integer not null default 0,
  add column if not exists last_rebroadcast_at timestamptz,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists image_storage_path text;

create index if not exists idx_customer_requests_fulfilled_store
  on public.customer_requests(fulfilled_store_id)
  where fulfilled_store_id is not null;

-- ---------------------------------------------------------------------------
-- Routing / response timing on targets
-- ---------------------------------------------------------------------------
alter table public.request_targets
  add column if not exists route_sent_at timestamptz not null default now(),
  add column if not exists opened_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists response_time_seconds integer,
  add column if not exists notify_after timestamptz,
  add column if not exists was_closed_at_route boolean not null default false;

-- Backfill viewed_at alias: opened_at preferred going forward
update public.request_targets
set opened_at = viewed_at
where opened_at is null and viewed_at is not null;

-- ---------------------------------------------------------------------------
-- Store coverage + response richness
-- ---------------------------------------------------------------------------
alter table public.stores
  add column if not exists service_radius_miles integer not null default 10
    check (service_radius_miles in (2, 5, 10, 15, 25));

alter table public.store_responses
  add column if not exists availability_amount text
    check (availability_amount is null or availability_amount in ('plenty', 'few_left', 'last_one'));

-- ---------------------------------------------------------------------------
-- Store applications: needs_info workflow
-- ---------------------------------------------------------------------------
alter table public.store_applications
  drop constraint if exists store_applications_status_check;

alter table public.store_applications
  add constraint store_applications_status_check
  check (status in ('pending', 'needs_info', 'approved', 'rejected'));

alter table public.store_applications
  add column if not exists admin_notes text,
  add column if not exists applicant_reply text;

-- ---------------------------------------------------------------------------
-- Pilot feedback (routing quality + experience)
-- ---------------------------------------------------------------------------
create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('customer', 'store')),
  request_id uuid references public.customer_requests(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  helpful boolean,
  relevance text check (
    relevance is null
    or relevance in ('relevant', 'wrong_category', 'too_far', 'other')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pilot_feedback_request on public.pilot_feedback(request_id);
create index if not exists idx_pilot_feedback_store on public.pilot_feedback(store_id);

alter table public.pilot_feedback enable row level security;

drop policy if exists "Users insert own pilot feedback" on public.pilot_feedback;
create policy "Users insert own pilot feedback"
  on public.pilot_feedback for insert
  with check (user_id = auth.uid());

drop policy if exists "Users read own pilot feedback" on public.pilot_feedback;
create policy "Users read own pilot feedback"
  on public.pilot_feedback for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Store managers read store feedback" on public.pilot_feedback;
create policy "Store managers read store feedback"
  on public.pilot_feedback for select
  using (
    store_id is not null
    and public.can_manage_store(store_id)
  );

-- ---------------------------------------------------------------------------
-- Rate-limit / abuse helper table (server-side)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 1,
  unique (bucket_key)
);

alter table public.rate_limit_buckets enable row level security;
-- No client policies — service role only

-- ---------------------------------------------------------------------------
-- Analytics events: allow authenticated insert of own events
-- ---------------------------------------------------------------------------
drop policy if exists "Users insert own analytics events" on public.analytics_events;
create policy "Users insert own analytics events"
  on public.analytics_events for insert
  with check (user_id is null or user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: request-images bucket + policies
-- Path convention: {user_id}/{request_id_or_uuid}.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-images',
  'request-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Keep product-images for backward compatibility notes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload request images" on storage.objects;
create policy "Authenticated users upload request images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read request images" on storage.objects;
create policy "Public read request images"
  on storage.objects for select
  to public
  using (bucket_id in ('request-images', 'product-images'));

drop policy if exists "Owners update own request images" on storage.objects;
create policy "Owners update own request images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners delete own request images" on storage.objects;
create policy "Owners delete own request images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime: feedback optional
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.pilot_feedback;
  exception when duplicate_object then null;
  end;
end $$;
