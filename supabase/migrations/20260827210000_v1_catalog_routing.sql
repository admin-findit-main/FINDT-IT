-- V1 catalog routing: business types, categories, keywords, store selections,
-- request classification columns, not_relevant responses. Reuses stores.

alter table public.stores
  add column if not exists business_type text,
  add column if not exists accepting_requests boolean not null default true;

alter table public.customer_requests
  add column if not exists detected_business_type text,
  add column if not exists detected_category text,
  add column if not exists detected_subcategory text,
  add column if not exists routing_confidence text,
  add column if not exists classification_status text,
  add column if not exists classification_reason text,
  add column if not exists category_confirmed boolean not null default false;

alter table public.request_targets
  add column if not exists routing_reason text,
  add column if not exists match_kind text,
  add column if not exists relevant boolean;

do $$ begin
  alter type response_type add value if not exists 'not_relevant';
exception when duplicate_object then null;
end $$;

create table if not exists public.catalog_business_types (
  id text primary key,
  name text not null,
  product_category text not null,
  store_category text not null,
  age_restricted boolean not null default false,
  sort_order integer not null default 100
);

create table if not exists public.catalog_categories (
  id text primary key,
  business_type_id text not null references public.catalog_business_types(id) on delete cascade,
  name text not null
);

create table if not exists public.catalog_subcategories (
  id text primary key,
  category_id text not null references public.catalog_categories(id) on delete cascade,
  name text not null
);

create table if not exists public.catalog_keywords (
  id text primary key,
  category_id text not null references public.catalog_categories(id) on delete cascade,
  subcategory_id text references public.catalog_subcategories(id) on delete set null,
  keyword text not null,
  normalized_keyword text not null,
  quality text not null default 'word'
);

create table if not exists public.store_catalog_categories (
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id text not null references public.catalog_categories(id) on delete cascade,
  primary key (store_id, category_id)
);

create table if not exists public.store_catalog_subcategories (
  store_id uuid not null references public.stores(id) on delete cascade,
  subcategory_id text not null references public.catalog_subcategories(id) on delete cascade,
  primary key (store_id, subcategory_id)
);

create table if not exists public.store_catalog_keywords (
  store_id uuid not null references public.stores(id) on delete cascade,
  keyword_id text not null references public.catalog_keywords(id) on delete cascade,
  primary key (store_id, keyword_id)
);

create table if not exists public.store_custom_keywords (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  keyword text not null,
  normalized_keyword text not null,
  unique (store_id, normalized_keyword)
);

create index if not exists catalog_keywords_normalized_idx
  on public.catalog_keywords (normalized_keyword);
create index if not exists store_catalog_categories_category_idx
  on public.store_catalog_categories (category_id);
create index if not exists stores_business_type_idx
  on public.stores (business_type);
create index if not exists stores_accepting_requests_idx
  on public.stores (accepting_requests)
  where accepting_requests = true and is_active = true and is_suspended = false;

insert into public.catalog_business_types (id, name, product_category, store_category, age_restricted, sort_order)
values
  ('smoke_shop', 'Smoke Shop', 'Tobacco & Vape', 'Smoke Shop', true, 10),
  ('coffee_shop', 'Coffee Shop', 'Coffee', 'Coffee Shop', false, 20),
  ('auto_parts', 'Auto Parts Store', 'Auto', 'Auto Parts', false, 30),
  ('nail_salon', 'Nail Salon', 'Nails', 'Nail Salon', false, 40),
  ('grocery', 'Grocery', 'Grocery', 'Grocery', false, 50),
  ('convenience', 'Convenience', 'Convenience', 'Convenience', false, 60),
  ('beauty', 'Beauty', 'Beauty', 'Beauty', false, 70),
  ('electronics', 'Electronics', 'Electronics', 'Electronics', false, 80),
  ('clothing', 'Clothing', 'Clothing', 'Clothing', false, 90),
  ('collectibles', 'Collectibles', 'Collectibles', 'Collectibles', false, 100),
  ('hardware', 'Hardware', 'Hardware', 'Hardware', false, 110),
  ('specialty_retail', 'Specialty Retail', 'Specialty', 'Specialty Retail', false, 120),
  ('other', 'Other', 'Other', 'Other', false, 130)
on conflict (id) do update set
  name = excluded.name,
  product_category = excluded.product_category,
  store_category = excluded.store_category,
  age_restricted = excluded.age_restricted;

insert into public.catalog_categories (id, business_type_id, name) values
  ('vapes', 'smoke_shop', 'Vapes'),
  ('cigars', 'smoke_shop', 'Cigars'),
  ('hookah', 'smoke_shop', 'Hookah'),
  ('smoke_snacks', 'smoke_shop', 'Snacks'),
  ('smoke_drinks', 'smoke_shop', 'Drinks'),
  ('smoke_accessories', 'smoke_shop', 'Accessories'),
  ('phone_accessories', 'smoke_shop', 'Phone Accessories'),
  ('coffee', 'coffee_shop', 'Coffee'),
  ('tea', 'coffee_shop', 'Tea'),
  ('matcha', 'coffee_shop', 'Matcha'),
  ('pastries', 'coffee_shop', 'Pastries'),
  ('breakfast', 'coffee_shop', 'Breakfast'),
  ('cold_drinks', 'coffee_shop', 'Cold Drinks'),
  ('brakes', 'auto_parts', 'Brakes'),
  ('auto_batteries', 'auto_parts', 'Batteries'),
  ('filters', 'auto_parts', 'Filters'),
  ('lighting', 'auto_parts', 'Lighting'),
  ('engine_parts', 'auto_parts', 'Engine Parts'),
  ('auto_accessories', 'auto_parts', 'Accessories'),
  ('manicure', 'nail_salon', 'Manicure'),
  ('pedicure', 'nail_salon', 'Pedicure'),
  ('gel', 'nail_salon', 'Gel'),
  ('acrylic', 'nail_salon', 'Acrylic'),
  ('nail_art', 'nail_salon', 'Nail Art'),
  ('grocery_goods', 'grocery', 'Grocery'),
  ('convenience_goods', 'convenience', 'Convenience'),
  ('beauty_goods', 'beauty', 'Beauty'),
  ('electronics_goods', 'electronics', 'Electronics'),
  ('clothing_goods', 'clothing', 'Clothing'),
  ('collectibles_goods', 'collectibles', 'Collectibles'),
  ('hardware_goods', 'hardware', 'Hardware'),
  ('specialty_goods', 'specialty_retail', 'Specialty'),
  ('other_goods', 'other', 'Other')
on conflict (id) do update set name = excluded.name, business_type_id = excluded.business_type_id;

insert into public.catalog_subcategories (id, category_id, name) values
  ('disposable_vapes', 'vapes', 'Disposables'),
  ('vape_batteries', 'vapes', 'Vape batteries')
on conflict (id) do update set name = excluded.name, category_id = excluded.category_id;

insert into public.catalog_keywords (id, category_id, subcategory_id, keyword, normalized_keyword, quality) values
  ('vape', 'vapes', null, 'vape', 'vape', 'word'),
  ('vapes', 'vapes', null, 'vapes', 'vapes', 'word'),
  ('disposable', 'vapes', null, 'disposable', 'disposable', 'word'),
  ('disposables', 'vapes', null, 'disposables', 'disposables', 'phrase'),
  ('disposable_vape', 'vapes', null, 'disposable vape', 'disposable vape', 'phrase'),
  ('e_liquid', 'vapes', null, 'e-liquid', 'e liquid', 'phrase'),
  ('e_liquid2', 'vapes', null, 'e liquid', 'e liquid', 'phrase'),
  ('ejuice', 'vapes', null, 'ejuice', 'ejuice', 'word'),
  ('pods', 'vapes', null, 'pods', 'pods', 'word'),
  ('geek_bar', 'vapes', null, 'geek bar', 'geek bar', 'brand'),
  ('raz', 'vapes', null, 'raz', 'raz', 'brand'),
  ('lost_mary', 'vapes', null, 'lost mary', 'lost mary', 'brand'),
  ('elf_bar', 'vapes', null, 'elf bar', 'elf bar', 'brand'),
  ('juicy_bar', 'vapes', null, 'juicy bar', 'juicy bar', 'brand'),
  ('bc5000', 'vapes', 'disposable_vapes', 'bc5000', 'bc5000', 'brand'),
  ('miami_mint', 'vapes', 'disposable_vapes', 'miami mint', 'miami mint', 'phrase'),
  ('18650', 'vapes', 'vape_batteries', '18650', '18650', 'phrase'),
  ('vape_battery', 'vapes', 'vape_batteries', 'vape battery', 'vape battery', 'phrase'),
  ('cigar', 'cigars', null, 'cigar', 'cigar', 'word'),
  ('cigars', 'cigars', null, 'cigars', 'cigars', 'word'),
  ('cigarillo', 'cigars', null, 'cigarillo', 'cigarillo', 'word'),
  ('hookah', 'hookah', null, 'hookah', 'hookah', 'word'),
  ('shisha', 'hookah', null, 'shisha', 'shisha', 'word'),
  ('grinder', 'smoke_accessories', null, 'grinder', 'grinder', 'word'),
  ('bong', 'smoke_accessories', null, 'bong', 'bong', 'word'),
  ('pipe', 'smoke_accessories', null, 'pipe', 'pipe', 'word'),
  ('phone_case_smoke', 'phone_accessories', null, 'phone case', 'phone case', 'phrase'),
  ('charger_smoke', 'phone_accessories', null, 'charger', 'charger', 'word'),
  ('coffee', 'coffee', null, 'coffee', 'coffee', 'word'),
  ('espresso', 'coffee', null, 'espresso', 'espresso', 'word'),
  ('latte', 'coffee', null, 'latte', 'latte', 'word'),
  ('cappuccino', 'coffee', null, 'cappuccino', 'cappuccino', 'word'),
  ('americano', 'coffee', null, 'americano', 'americano', 'word'),
  ('tea', 'tea', null, 'tea', 'tea', 'word'),
  ('chai', 'tea', null, 'chai', 'chai', 'word'),
  ('matcha', 'matcha', null, 'matcha', 'matcha', 'word'),
  ('pastry', 'pastries', null, 'pastry', 'pastry', 'word'),
  ('croissant', 'pastries', null, 'croissant', 'croissant', 'word'),
  ('muffin', 'pastries', null, 'muffin', 'muffin', 'word'),
  ('breakfast', 'breakfast', null, 'breakfast', 'breakfast', 'word'),
  ('bagel', 'breakfast', null, 'bagel', 'bagel', 'word'),
  ('cold_brew', 'cold_drinks', null, 'cold brew', 'cold brew', 'phrase'),
  ('iced_coffee', 'cold_drinks', null, 'iced coffee', 'iced coffee', 'phrase'),
  ('brake', 'brakes', null, 'brake', 'brake', 'word'),
  ('brakes', 'brakes', null, 'brakes', 'brakes', 'word'),
  ('brake_pads', 'brakes', null, 'brake pads', 'brake pads', 'phrase'),
  ('brake_rotors', 'brakes', null, 'brake rotors', 'brake rotors', 'phrase'),
  ('car_battery', 'auto_batteries', null, 'car battery', 'car battery', 'phrase'),
  ('auto_battery', 'auto_batteries', null, 'auto battery', 'auto battery', 'phrase'),
  ('battery_honda', 'auto_batteries', null, 'battery', 'battery', 'word'),
  ('oil_filter', 'filters', null, 'oil filter', 'oil filter', 'phrase'),
  ('air_filter', 'filters', null, 'air filter', 'air filter', 'phrase'),
  ('cabin_filter', 'filters', null, 'cabin filter', 'cabin filter', 'phrase'),
  ('headlight', 'lighting', null, 'headlight', 'headlight', 'word'),
  ('taillight', 'lighting', null, 'taillight', 'taillight', 'word'),
  ('headlamp', 'lighting', null, 'headlamp', 'headlamp', 'word'),
  ('spark_plug', 'engine_parts', null, 'spark plug', 'spark plug', 'phrase'),
  ('alternator', 'engine_parts', null, 'alternator', 'alternator', 'word'),
  ('starter', 'engine_parts', null, 'starter', 'starter', 'word'),
  ('wiper', 'auto_accessories', null, 'wiper', 'wiper', 'word'),
  ('floor_mat', 'auto_accessories', null, 'floor mat', 'floor mat', 'phrase'),
  ('manicure', 'manicure', null, 'manicure', 'manicure', 'word'),
  ('mani', 'manicure', null, 'mani', 'mani', 'word'),
  ('pedicure', 'pedicure', null, 'pedicure', 'pedicure', 'word'),
  ('pedi', 'pedicure', null, 'pedi', 'pedi', 'word'),
  ('gel_nails', 'gel', null, 'gel nails', 'gel nails', 'phrase'),
  ('gel_manicure', 'gel', null, 'gel manicure', 'gel manicure', 'phrase'),
  ('acrylic', 'acrylic', null, 'acrylic', 'acrylic', 'word'),
  ('nail_art', 'nail_art', null, 'nail art', 'nail art', 'phrase'),
  ('nails', 'nail_art', null, 'nails', 'nails', 'word'),
  ('grocery', 'grocery_goods', null, 'grocery', 'grocery', 'word'),
  ('convenience', 'convenience_goods', null, 'convenience', 'convenience', 'word'),
  ('beauty', 'beauty_goods', null, 'beauty', 'beauty', 'word'),
  ('makeup', 'beauty_goods', null, 'makeup', 'makeup', 'word'),
  ('electronics', 'electronics_goods', null, 'electronics', 'electronics', 'word'),
  ('iphone', 'electronics_goods', null, 'iphone', 'iphone', 'brand'),
  ('ipad', 'electronics_goods', null, 'ipad', 'ipad', 'brand'),
  ('clothing', 'clothing_goods', null, 'clothing', 'clothing', 'word'),
  ('nike', 'clothing_goods', null, 'nike', 'nike', 'brand'),
  ('collectible', 'collectibles_goods', null, 'collectible', 'collectible', 'word'),
  ('hardware', 'hardware_goods', null, 'hardware', 'hardware', 'word'),
  ('specialty', 'specialty_goods', null, 'specialty', 'specialty', 'word')
on conflict (id) do update set
  keyword = excluded.keyword,
  normalized_keyword = excluded.normalized_keyword,
  category_id = excluded.category_id,
  subcategory_id = excluded.subcategory_id,
  quality = excluded.quality;

update public.stores s
set business_type = case
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category in ('Smoke Shop', 'Tobacco & Vape')
  ) then 'smoke_shop'
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category in ('Auto Parts', 'Auto')
  ) then 'auto_parts'
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category in ('Coffee Shop', 'Coffee')
  ) then 'coffee_shop'
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category in ('Nail Salon', 'Nails')
  ) then 'nail_salon'
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category = 'Grocery'
  ) then 'grocery'
  when exists (
    select 1 from public.store_categories sc
    where sc.store_id = s.id and sc.category = 'Convenience'
  ) then 'convenience'
  else coalesce(s.business_type, 'other')
end
where s.business_type is null;

insert into public.store_catalog_categories (store_id, category_id)
select s.id, c.id
from public.stores s
join public.catalog_categories c on c.business_type_id = s.business_type
where s.business_type is not null
on conflict do nothing;

alter table public.catalog_business_types enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_subcategories enable row level security;
alter table public.catalog_keywords enable row level security;
alter table public.store_catalog_categories enable row level security;
alter table public.store_catalog_subcategories enable row level security;
alter table public.store_catalog_keywords enable row level security;
alter table public.store_custom_keywords enable row level security;

drop policy if exists catalog_types_read on public.catalog_business_types;
create policy catalog_types_read on public.catalog_business_types for select using (true);
drop policy if exists catalog_categories_read on public.catalog_categories;
create policy catalog_categories_read on public.catalog_categories for select using (true);
drop policy if exists catalog_subcategories_read on public.catalog_subcategories;
create policy catalog_subcategories_read on public.catalog_subcategories for select using (true);
drop policy if exists catalog_keywords_read on public.catalog_keywords;
create policy catalog_keywords_read on public.catalog_keywords for select using (true);

drop policy if exists store_catalog_categories_read on public.store_catalog_categories;
create policy store_catalog_categories_read on public.store_catalog_categories
  for select using (
    public.is_store_member(store_id) or public.is_admin()
    or exists (select 1 from public.stores s where s.id = store_id and s.is_active)
  );
drop policy if exists store_catalog_categories_write on public.store_catalog_categories;
create policy store_catalog_categories_write on public.store_catalog_categories
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists store_catalog_subcategories_read on public.store_catalog_subcategories;
create policy store_catalog_subcategories_read on public.store_catalog_subcategories
  for select using (public.is_store_member(store_id) or public.is_admin() or exists (select 1 from public.stores s where s.id = store_id and s.is_active));
drop policy if exists store_catalog_subcategories_write on public.store_catalog_subcategories;
create policy store_catalog_subcategories_write on public.store_catalog_subcategories
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists store_catalog_keywords_read on public.store_catalog_keywords;
create policy store_catalog_keywords_read on public.store_catalog_keywords
  for select using (public.is_store_member(store_id) or public.is_admin() or exists (select 1 from public.stores s where s.id = store_id and s.is_active));
drop policy if exists store_catalog_keywords_write on public.store_catalog_keywords;
create policy store_catalog_keywords_write on public.store_catalog_keywords
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists store_custom_keywords_read on public.store_custom_keywords;
create policy store_custom_keywords_read on public.store_custom_keywords
  for select using (public.is_store_member(store_id) or public.is_admin());
drop policy if exists store_custom_keywords_write on public.store_custom_keywords;
create policy store_custom_keywords_write on public.store_custom_keywords
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

grant select on public.catalog_business_types, public.catalog_categories, public.catalog_subcategories, public.catalog_keywords
  to anon, authenticated, service_role;
grant select, insert, update, delete on public.store_catalog_categories, public.store_catalog_subcategories, public.store_catalog_keywords, public.store_custom_keywords
  to authenticated, service_role;
