# FINDIT

Ask nearby stores if they have what you’re looking for.

FINDIT is a mobile-first PWA where customers submit a product request, nearby participating stores respond **In Stock / Out of Stock / Can Order**, and store owners see anonymous demand analytics for products customers want.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Expo Router native apps (`apps/customer-mobile`, `apps/employee-mobile`)
- Shared packages: `@findit/domain`, `@findit/types`, `@findit/supabase-client`
- Supabase (Postgres, Auth, Storage, RLS, Realtime, Edge Functions)
- React Hook Form patterns + Zod validation
- Vitest for core business-logic tests
- Vercel-ready deployment / EAS for TestFlight

## Quick start

```bash
cp .env.example .env.local
# Fill Supabase URL, anon/publishable key, and service role key (web only)
# Set FINDIT_DEMO_MODE=false and FINDIT_PILOT_MODE=true for pilot
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

Native apps: see [MOBILE.md](./MOBILE.md) (`npm run mobile:customer` / `npm run mobile:employee`).

For phone testing on the same Wi‑Fi, set `NEXT_PUBLIC_APP_URL` in `.env.local` to `http://<your-lan-ip>:3002` (e.g. from `ipconfig getifaddr en0` on macOS). `npm run dev` already binds to `0.0.0.0`, so open that LAN URL on your phone.

### Acceptance flow (pilot)

1. Sign up / log in as a **customer** → Home → search a product → Ask Nearby Stores  
2. Log in as a **store employee** → Store dashboard → **In Stock** (optional price)  
3. Back as **customer** → request detail shows the response → mark found / still looking  
4. Log in as **owner** → Demand → see requested products / missing opportunities  
5. Log in as **admin** → `/admin` funnel + applications  

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser)
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY` (optional email fallback)
- `STRIPE_*` (optional; subscription fields are prepared)
- `FINDIT_DEMO_MODE` — must be `false` for the real app; `true` only for Vitest / offline unit tests
- `FINDIT_BYPASS_PLAN_LIMITS`
- `FINDIT_PILOT_MODE` (closed pilot: Beta UI + relaxed usage caps, no Stripe)

Optional integrations fail gracefully when keys are absent.

## FINDIT Pilot Launch

1. Create a Supabase project  
2. Copy URL + anon key + service role key into `.env.local`  
3. Set `FINDIT_DEMO_MODE=false` and `FINDIT_PILOT_MODE=true`  
4. Run **all** SQL migrations in order:

```bash
# Using Supabase CLI
supabase db push
# or paste these into the SQL editor (in order):
#   supabase/migrations/20260326000001_init.sql
#   supabase/migrations/20260326000002_store_applications_and_plans.sql
#   supabase/migrations/20260326000003_pilot_realtime_and_applicant_rls.sql
#   supabase/migrations/20260326000004_pilot_v1.sql
#   supabase/migrations/20260326000005_fix_rls_recursion.sql
#   supabase/migrations/20260326000006_fix_request_insert_rls.sql
```

5. Confirm Storage bucket `request-images` (created by migration 0004; JPEG/PNG/WEBP, 5MB).  
6. Auth: enable Email provider; set redirect URLs to `{APP_URL}/auth/callback` and `{APP_URL}/auth/update-password`.  
7. Realtime: migrations add core tables to `supabase_realtime`.  
8. Promote an admin: `update profiles set account_type = 'admin' where email = 'you@example.com';`  
9. Approve first store via `/admin` after `/join`  
10. Create store employee + customer → submit request → respond → confirm found → check `/admin` funnel  

See **PILOT_CHECKLIST.md** for the full go/no-go list and 10-minute acceptance test.

### RLS summary

- Customers read/update only their profile and requests.
- Stores only see requests targeted to their store.
- Employees can respond only for stores they belong to.
- Owners/managers manage hours, coverage, and team; employees cannot.
- Admins are gated by `account_type = admin` (server-checked for `/admin`).
- Request images upload only under `{user_id}/…` in `request-images`.

## Scripts

```bash
npm run dev          # local development
npm run build        # production build
npm run start        # start production server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run seed         # seed helper instructions
```

## Architecture

```
src/app/(auth)        login / signup / forgot password
src/app/(customer)    home, requests, notifications, profile
src/app/(store)       dashboard, demand, team, settings, onboarding
src/app/admin         pilot dashboard + applications
src/app/stores/[slug] public store profile
src/lib/services      server actions / routing / lifecycle / storage
src/lib/demo          in-memory backend for Vitest only (FINDIT_DEMO_MODE=true)
src/lib/validations   Zod schemas
supabase/migrations   schema + RLS + indexes + storage
```

Core services:

- `createCustomerRequestAction` → create + route request (duplicate detection)  
- `routeRequestToStoresAction` → ZIP / radius / category / active store matching  
- `respondToRequestAction` → in_stock / out_of_stock / can_order + timing  
- `fulfillRequestAction` / `stillLookingAction` → lifecycle  
- `getStoreDemandAction` / `getPilotAdminStatsAction` → pilot analytics  
- notifications on new request / stock replies / customer found  

## Plans

Configured in `src/lib/config/constants.ts`:

**Customer:** FINDIT FREE / FINDIT+ ($3.99)  
**Store:** Pilot (60-day free) → Starter ($29) / Pro ($59) per location  

During `FINDIT_PILOT_MODE=true`, free-tier request caps are relaxed. Stripe is not connected.

## PWA

- `public/manifest.webmanifest`
- theme color + standalone display
- service worker only falls back navigations to `/offline.html` (does not cache authenticated API data)
- icons in `public/icons/*`

## Testing

```bash
npm run test
```

Critical coverage:

- request creation + routing + category/radius exclusion  
- ineligible store cannot respond  
- employee response updates customer notifications  
- response upsert (no duplicates)  
- expired requests reject responses  
- fulfillment + still looking + duplicate prevention  
- pilot mode limit flags  
- demand analytics opportunity scoring  

## Production deployment (Vercel)

1. Push repo to GitHub.
2. Import project in Vercel.
3. Set environment variables (`FINDIT_DEMO_MODE=false`, `FINDIT_PILOT_MODE=true` for closed pilot).
4. Deploy.
5. Point Supabase Auth redirect URLs to your production domain.

## Known MVP limitations

- Email / web push / Stripe are stubbed for later connection.
- Distance uses ZIP/city heuristics (not full geospatial maps).
- Legal pages are placeholders (not attorney-reviewed).
- No SMS, checkout, delivery, AI matching, or POS sync (intentionally out of scope).

## Product principle

FINDIT does not depend on perfect inventory systems. Employees answer quickly:

**YES / NO / CAN ORDER**

Demand data is collected naturally from customer behavior. Primary metric: **time to first useful response**.
