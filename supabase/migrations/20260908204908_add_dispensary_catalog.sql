-- Add first-class dispensary routing without changing any existing store.
-- Catalog tables, RLS policies, and grants were created by v1_catalog_routing.

insert into public.catalog_business_types (
  id,
  name,
  product_category,
  store_category,
  age_restricted,
  sort_order
)
values ('dispensary', 'Dispensary', 'Dispensary', 'Dispensary', true, 15)
on conflict (id) do update set
  name = excluded.name,
  product_category = excluded.product_category,
  store_category = excluded.store_category,
  age_restricted = excluded.age_restricted,
  sort_order = excluded.sort_order;

insert into public.catalog_categories (id, business_type_id, name)
values
  ('dispensary_flower', 'dispensary', 'Flower'),
  ('dispensary_edibles', 'dispensary', 'Edibles'),
  ('dispensary_concentrates', 'dispensary', 'Concentrates'),
  ('dispensary_vapes', 'dispensary', 'Cannabis Vapes'),
  ('dispensary_prerolls', 'dispensary', 'Pre-rolls'),
  ('dispensary_accessories', 'dispensary', 'Accessories')
on conflict (id) do update set
  business_type_id = excluded.business_type_id,
  name = excluded.name;

insert into public.catalog_keywords (
  id,
  category_id,
  subcategory_id,
  keyword,
  normalized_keyword,
  quality
)
values
  ('cannabis_flower', 'dispensary_flower', null, 'cannabis flower', 'cannabis flower', 'phrase'),
  ('marijuana', 'dispensary_flower', null, 'marijuana', 'marijuana', 'word'),
  ('weed', 'dispensary_flower', null, 'weed', 'weed', 'word'),
  ('cannabis_edible', 'dispensary_edibles', null, 'cannabis edible', 'cannabis edible', 'phrase'),
  ('edibles', 'dispensary_edibles', null, 'edibles', 'edibles', 'word'),
  ('gummies', 'dispensary_edibles', null, 'gummies', 'gummies', 'word'),
  ('concentrate', 'dispensary_concentrates', null, 'concentrate', 'concentrate', 'word'),
  ('dab', 'dispensary_concentrates', null, 'dab', 'dab', 'word'),
  ('wax', 'dispensary_concentrates', null, 'wax', 'wax', 'word'),
  ('cannabis_vape', 'dispensary_vapes', null, 'cannabis vape', 'cannabis vape', 'phrase'),
  ('thc_cart', 'dispensary_vapes', null, 'thc cart', 'thc cart', 'phrase'),
  ('thc_cartridge', 'dispensary_vapes', null, 'thc cartridge', 'thc cartridge', 'phrase'),
  ('pre_roll', 'dispensary_prerolls', null, 'pre-roll', 'pre roll', 'phrase'),
  ('pre_roll_plain', 'dispensary_prerolls', null, 'pre roll', 'pre roll', 'phrase'),
  ('preroll', 'dispensary_prerolls', null, 'preroll', 'preroll', 'word'),
  ('dispensary_grinder', 'dispensary_accessories', null, 'grinder', 'grinder', 'word'),
  ('rolling_papers', 'dispensary_accessories', null, 'rolling papers', 'rolling papers', 'phrase')
on conflict (id) do update set
  category_id = excluded.category_id,
  subcategory_id = excluded.subcategory_id,
  keyword = excluded.keyword,
  normalized_keyword = excluded.normalized_keyword,
  quality = excluded.quality;
