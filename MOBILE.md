# FINDIT native mobile

Customer and employee Expo apps share Supabase with the Next.js web pilot.

## Prerequisites

- Node 20+ (nvm recommended)
- Same Supabase project as web (`.env.local` at repo root)
- Copy publishable keys only into each app `.env` (never `SUPABASE_SERVICE_ROLE_KEY`)

```bash
cp apps/customer-mobile/.env.example apps/customer-mobile/.env
cp apps/employee-mobile/.env.example apps/employee-mobile/.env
# Fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY from root .env.local
```

## Run web (unchanged)

```bash
cd /Applications/FINDIT!
npm install
npm run dev          # http://0.0.0.0:3002
npm test
npm run typecheck
```

Keep `FINDIT_DEMO_MODE=false` and `FINDIT_PILOT_MODE=true`.

## Run customer mobile

```bash
npm run mobile:customer
# or: cd apps/customer-mobile && npx expo start
```

Then press `i` (simulator) or scan the QR with Expo Go / a dev client.

## Run employee mobile

```bash
npm run mobile:employee
# or: cd apps/employee-mobile && npx expo start
```

Tablet: rotate / use iPad simulator — queue uses a 2-column terminal layout ≥768px width.

## Edge Functions

```bash
# From repo root with supabase CLI logged in
npx supabase functions deploy create-and-route-request
npx supabase functions deploy respond-to-request
npx supabase db push   # applies device_push_tokens + notification RLS migration
```

Optional secret for Expo push: `EXPO_ACCESS_TOKEN` (push still sends without it; the token is recommended in production).

## EAS / TestFlight

```bash
cd apps/customer-mobile   # or employee-mobile
npx eas-cli login
# set extra.eas.projectId in app.json
npx eas build --platform ios --profile preview
```

Bundle IDs: `com.findit.customer` · `com.findit.employee` · Hub tablet `com.findit.hub`

Owner/admin remain on the web URL (`npm run dev` / production web).

## FINDIT Hub Android (counter tablet)

Native kiosk in `apps/hub-android`. It opens `https://store.askfindit.com/hub` full screen (no browser chrome), landscape, with the FINDIT splash. Pairing uses the existing Devices code; the WebView keeps the device cookie so the tablet reconnects after a restart. Set FINDIT Hub as the **Home app** so it launches after reboot. Unplug to let the screen sleep; plug in to keep it awake.

Open the folder in Android Studio (JDK 17). Details: `apps/hub-android/README.md`.

## Morning checklist

```bash
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
cd /Applications/FINDIT!

# Web (http://localhost:3002) — already may be running overnight
npm run dev

# Customer app (Expo Go / simulator)
npm run mobile:customer
# then press i, or scan QR

# Employee app (tablet-friendly queue ≥768px)
npm run mobile:employee

# Optional sanity
npm test && npm run test:domain && npm run typecheck
```

Confirm `.env.local` has `FINDIT_DEMO_MODE=false` and `FINDIT_PILOT_MODE=true`. Mobile `.env` files stay **public keys only** (never `SUPABASE_SERVICE_ROLE_KEY`).

Owner/admin testing stays on web. Edge Functions `create-and-route-request` and `respond-to-request` are deployed ACTIVE on the shared Supabase project.

## Security notes

- Mobile binaries use **anon key + user JWT** only.
- Privileged create/route/notify uses Edge Functions with service role **server-side**.
- `notifications` INSERT RLS is own-row only; cross-user fanout is Edge/service role.
- See `packages/domain/src/__tests__/security-edge.test.ts` for routing/lifecycle guards.
