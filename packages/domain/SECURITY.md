# Shared domain security notes

## Rules
- Never embed `SUPABASE_SERVICE_ROLE_KEY` in Expo apps or any client bundle.
- Mobile create/route uses Edge Function `create-and-route-request` (JWT + service role on server).
- Mobile respond uses Edge Function `respond-to-request` for notification fanout after RLS membership checks.
- `notifications` INSERT is own-row (or admin) only after migration `20260326000009_...`.
- `device_push_tokens` rows are user-owned via RLS; multi-device per user/store supported.

## Tests
```bash
npm test
npm run test:domain
```

Covers suspended stores, already-targeted stores, expired still-looking, and near-duplicate requests.
