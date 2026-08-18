-- FINDIT Hub: dedicated store-device pairing (counter tablets / POS browsers).
-- Pairing codes and device tokens are hashed. Service role writes pairing rows.
-- Authenticated owners/managers may list, rename, and revoke devices for their store.

alter table public.store_invites
  add column if not exists invitee_name text;

comment on column public.store_invites.invitee_name is
  'Optional name the owner typed when inviting. Copied onto the profile on accept if the profile has no first name.';

create table if not exists public.store_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  device_name text not null default 'Store device',
  token_hash text not null unique,
  paired_by uuid references public.profiles(id) on delete set null,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_devices_name_len check (char_length(device_name) between 1 and 80)
);

create index if not exists store_devices_store_idx
  on public.store_devices (store_id, revoked_at);

comment on table public.store_devices is
  'Paired FINDIT Hub terminals. token_hash is sha256 of the device session secret; the secret is never stored.';

create table if not exists public.device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  requester_secret_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  store_id uuid references public.stores(id) on delete cascade,
  device_id uuid references public.store_devices(id) on delete set null,
  issued_token text,
  created_at timestamptz not null default now()
);

create unique index if not exists device_pairing_codes_active_hash_uidx
  on public.device_pairing_codes (code_hash)
  where used_at is null;

create index if not exists device_pairing_codes_expires_idx
  on public.device_pairing_codes (expires_at);

comment on table public.device_pairing_codes is
  'Short-lived Hub pairing challenges. 6-digit codes are HMAC-hashed. issued_token is wiped after the waiting device redeems it.';

alter table public.store_devices enable row level security;
alter table public.device_pairing_codes enable row level security;

revoke all on table public.store_devices from anon, authenticated;
revoke all on table public.device_pairing_codes from anon, authenticated;

grant select, update on public.store_devices to authenticated;

drop policy if exists "store_devices_select_managers" on public.store_devices;
create policy "store_devices_select_managers"
  on public.store_devices
  for select
  to authenticated
  using (public.can_manage_store(store_id) or public.is_admin());

drop policy if exists "store_devices_update_managers" on public.store_devices;
create policy "store_devices_update_managers"
  on public.store_devices
  for update
  to authenticated
  using (public.can_manage_store(store_id) or public.is_admin())
  with check (public.can_manage_store(store_id) or public.is_admin());
