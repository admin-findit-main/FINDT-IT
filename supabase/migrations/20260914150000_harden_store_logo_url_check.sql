-- Tighten public store logo URLs to https raster images only (no SVG / data / userinfo).
alter table public.stores
  drop constraint if exists stores_logo_url_https;

alter table public.stores
  add constraint stores_logo_url_https
  check (
    logo_url is null
    or (
      char_length(logo_url) between 12 and 500
      and logo_url ~* '^https://[^/@]+/'
      and logo_url ~* '\.(png|jpe?g|gif|webp)(\?|#|$)'
    )
  );

comment on column public.stores.logo_url is
  'Optional public HTTPS URL (PNG/JPG/GIF/WebP) for the store mark on customer notifications.';
