-- device push tokens + tighten notifications INSERT RLS
-- Safe additive migration: does not reset pilot data.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null,
  store_id uuid references public.stores(id) on delete set null,
  app_surface text not null default 'customer'
    check (app_surface in ('customer', 'employee', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id);
create index if not exists device_push_tokens_store_idx
  on public.device_push_tokens (store_id)
  where store_id is not null;
create index if not exists device_push_tokens_token_idx
  on public.device_push_tokens (token);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own" on public.device_push_tokens
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
create policy "device_push_tokens_insert_own" on public.device_push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
create policy "device_push_tokens_update_own" on public.device_push_tokens
  for update using (user_id = auth.uid());

drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;
create policy "device_push_tokens_delete_own" on public.device_push_tokens
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.device_push_tokens to authenticated;

-- Tighten notifications INSERT: authenticated users may only insert rows for themselves.
-- Fanout to other users must use service role / Edge Functions.
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert with check (user_id = auth.uid() or public.is_admin());
