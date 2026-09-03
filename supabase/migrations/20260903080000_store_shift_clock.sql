-- Floor staff for FINDIT Hub: 4-digit PIN, clock in/out on a paired tablet.
-- Service role writes these rows. Authenticated clients have no table grants.

create table if not exists public.store_shift_employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  display_name text not null,
  pin text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_shift_employees_name_len
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint store_shift_employees_pin_digits
    check (pin is null or pin ~ '^[0-9]{4}$')
);

create index if not exists store_shift_employees_store_idx
  on public.store_shift_employees (store_id, active);

create unique index if not exists store_shift_employees_store_pin_uidx
  on public.store_shift_employees (store_id, pin)
  where pin is not null;

comment on table public.store_shift_employees is
  'People who clock into FINDIT Hub with a 4-digit PIN. PINs are store-local POS codes, visible to owners and managers.';

create table if not exists public.store_shift_punches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid not null references public.store_shift_employees(id) on delete cascade,
  device_id uuid references public.store_devices(id) on delete set null,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_shift_punches_out_after_in
    check (clocked_out_at is null or clocked_out_at >= clocked_in_at)
);

create index if not exists store_shift_punches_store_in_idx
  on public.store_shift_punches (store_id, clocked_in_at desc);

create unique index if not exists store_shift_punches_open_uidx
  on public.store_shift_punches (employee_id)
  where clocked_out_at is null;

comment on table public.store_shift_punches is
  'Hub clock-in and clock-out. One open punch per employee.';

alter table public.store_shift_employees enable row level security;
alter table public.store_shift_punches enable row level security;

revoke all on table public.store_shift_employees from anon, authenticated;
revoke all on table public.store_shift_punches from anon, authenticated;
