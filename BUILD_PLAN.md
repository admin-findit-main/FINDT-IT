# FINDIT — Implementation Checklist

## Status legend
- [x] Done
- [ ] Pending

---

## Phase A — Foundation
- [x] Next.js + TypeScript + Tailwind scaffold
- [x] Project structure (`app/`, `components/`, `lib/`, `types/`, migrations)
- [x] Environment validation (`.env.example`)
- [x] Supabase clients (browser, server, middleware, service role)
- [x] Database schema + migrations + indexes
- [x] Row Level Security policies
- [x] Auth (email/password, password reset, role handling)
- [x] Shared UI primitives (shadcn-style)
- [x] Plan configuration (free / starter / pro)
- [x] Demo mode backend for local MVP without keys

## Phase B — Customer
- [x] Landing page
- [x] Legal pages (Privacy, Terms, Acceptable Use, Business Terms)
- [x] Auth screens (login, signup, forgot password)
- [x] Customer home (“What are you looking for?”)
- [x] Create request flow + image upload (Storage in production)
- [x] Request routing to eligible stores
- [x] Results screen + realtime/polling + waiting state
- [x] I found it / Still looking / success feedback
- [x] Duplicate request detection
- [x] Request history (Active / Past / Saved)
- [x] Customer profile + notification preferences
- [x] Customer mobile bottom nav

## Phase C — Store
- [x] Multi-step store onboarding + `/join` applications
- [x] Store dashboard (incoming requests + one-tap respond)
- [x] Response flows: In Stock / Out of Stock / Can Order
- [x] This-week performance metrics
- [x] Request filters
- [x] Store settings (hours, service area/radius, categories, plan)
- [x] Team invites + roles (owner / manager / employee)
- [x] Public store profile
- [x] Store mobile nav + desktop sidebar

## Phase D — Analytics
- [x] Demand aggregation (most requested / missed / consider stocking)
- [x] Response metrics (rates, avg/median response time)
- [x] Request trends (today / week)
- [x] Internal analytics events
- [x] Pilot feedback collection

## Phase E — Admin
- [x] `/admin` pilot dashboard (funnel + timing + success)
- [x] Users / Stores / Requests tables
- [x] Store applications Approve / Reject / Needs info
- [x] Reports placeholder + suspension fields in schema

## Phase F — Quality
- [x] PWA (manifest, icons, offline shell — no auth API caching)
- [x] Notifications (in-app)
- [x] Skeleton / empty / error / success states
- [x] Abuse protection (rate limits, file validation, prohibited terms)
- [x] Pilot mode config
- [x] Seed script + demo accounts (dev only)
- [x] Critical path + pilot-v1 tests (Vitest)
- [x] README + Pilot Launch docs
- [x] Lint/typecheck/production build

---

## Core loop (must work)
1. Customer creates request
2. System routes to eligible stores
3. Employee responds YES / NO / CAN ORDER
4. Customer sees response (live refresh)
5. Customer can mark found + success signal
6. Owner/admin see demand + pilot analytics

## Explicitly out of scope (v1)
AI matching, barcode, POS sync, delivery, checkout, SMS, native apps, reviews, loyalty, maps infrastructure, Stripe charges.
