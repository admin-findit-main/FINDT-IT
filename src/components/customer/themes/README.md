# Customer themes

Assign themes in the database (or admin SQL), never from the client.

```sql
update public.profiles
set theme_id = 'pooh'  -- or default | dark | seasonal | custom
where id = '<profile-uuid>';
```

Runtime detection uses only `profile.theme_id` (see `CustomerThemeRoot`).

## Add a theme

1. Allow the id in the DB check constraint (migration).
2. Add the id to `CustomerThemeId` in `packages/types`.
3. Add `src/components/customer/themes/<id>/` with a shell + CSS.
4. Wire it in `theme-root.tsx` / `theme-slots.tsx` behind `themeId === "<id>"` and `dynamic()` so default users do not download it.

## Edit Pooh

Edit files under `src/components/customer/themes/pooh/`:

- `theme.css` — colors / canvas
- `shell.tsx` — decorations + easter egg
- `home-greeting.tsx` / `profile-banner.tsx` — page accents
- `find-home-background.tsx` — Find home query-step backdrop
- `marks.tsx` — original SVG placeholders (replace with licensed art later)

Find-home art asset: `public/themes/pooh/find-home-bg.png`
