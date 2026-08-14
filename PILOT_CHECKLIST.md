# FINDIT Pilot Readiness Checklist

Last updated for **FINDIT Pilot v1**.

## Fully working (with Supabase configured)

- [x] Customer signup / login (email + password)
- [x] Store owner / employee / admin roles via profiles + store_members
- [x] Customer creates product request → persisted in `customer_requests`
- [x] Request routing by ZIP + category + radius + active/approved stores
- [x] Duplicate routing prevented; target timing fields (`route_sent_at`, `opened_at`, `responded_at`)
- [x] Store employee inbox with one-tap In Stock / Out / Can Order (+ optional details)
- [x] Customer request detail: sorted responses, waiting state, **I found it**, Still looking
- [x] Success signal: “Did FINDIT help you find this product?”
- [x] Supabase Realtime (+ polling fallback)
- [x] `/join` → admin Approve / Reject / **Request more info** → 60-day trial provisioning
- [x] Forgot password → `/auth/update-password`
- [x] Demand intelligence (high / missed / consider stocking)
- [x] Store this-week performance strip
- [x] Admin pilot dashboard (funnel, response times, success rate)
- [x] Store hours + coverage (ZIPs + radius) editable by owner/manager
- [x] `request-images` Storage bucket + policies (migration 0004)
- [x] Pilot mode (`FINDIT_PILOT_MODE`) relaxes free-plan caps
- [x] Internal analytics events table
- [x] RLS for core tables + storage path ownership

## Still uses mock / demo behavior

- [ ] In-memory demo backend only when `FINDIT_DEMO_MODE=true` (Vitest / offline tests — never for pilot)
- [ ] Legal pages are placeholders (not attorney-reviewed)
- [ ] Email/SMS/web push delivery not required for core loop
- [ ] Seed script prints instructions only

## Requires environment / API configuration

1. Create a Supabase project
2. Set in `.env.local` / Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (**server only**)
   - `NEXT_PUBLIC_APP_URL`
   - `FINDIT_DEMO_MODE=false`
   - `FINDIT_PILOT_MODE=true` (recommended for closed pilot)
   - `FINDIT_BYPASS_PLAN_LIMITS=false` (pilot mode already relaxes caps)
3. Apply **all** migrations:
   - `20260326000001_init.sql`
   - `20260326000002_store_applications_and_plans.sql`
   - `20260326000003_pilot_realtime_and_applicant_rls.sql`
   - `20260326000004_pilot_v1.sql` (lifecycle, storage, feedback, coverage)
4. Auth redirect URLs: `{APP_URL}/auth/callback`, `{APP_URL}/auth/update-password`
5. Realtime publication (migration 0003/0004)
6. Storage bucket `request-images` is created by migration 0004 (verify in dashboard)
7. Promote admin: `update profiles set account_type = 'admin' where email = 'you@example.com';`

## FINDIT Pilot Launch

Step-by-step:

1. Create a Supabase project  
2. Configure environment variables (above)  
3. Run all four migrations in order (`supabase db push` or SQL editor)  
4. Confirm Storage bucket `request-images` exists (public read, auth upload to `{user_id}/…`)  
5. Configure Auth email provider + redirect URLs  
6. Create/promote an admin user  
7. Submit a store via `/join` and **Approve** in `/admin`  
8. Invite or create a store employee (owner is provisioned on approve)  
9. Create a customer account  
10. Customer submits a real product request near the store ZIP  
11. Employee answers **In Stock** from `/store`  
12. Customer sees the response on `/requests/[id]` (Realtime)  
13. Customer taps **I found it** → confirm FINDIT helped  
14. Verify admin funnel + store demand/metrics  

## Acceptance test (must pass)

**Browser A — Customer**

1. Sign up / log in as customer  
2. Ask for a product near a ZIP that an approved store serves  
3. Confirm “Sent to N stores” / waiting state  

**Browser B — Store employee**

4. Log in as store member  
5. See the request  
6. Tap **In Stock** (optional details)  

**Browser A**

7. Response appears without manual refresh  
8. **I found it** → YES FINDIT helped  
9. Open store + Get Directions  

**Browser C — Admin**

10. `/admin` shows funnel movement and request/response activity  

## Safe to test with real customers & stores?

**Yes for a closed pilot** after the config above.

**Not yet a wide public launch** until: production HTTPS domain, attorney-reviewed legal, monitoring, and abuse review under load.

## Security notes

| Issue | Action |
|-------|--------|
| Service role key in client | Never prefix with `NEXT_PUBLIC_` |
| Demo mode in production | Must be `FINDIT_DEMO_MODE=false` |
| Admin promotion | Manual SQL only |
| Employee permissions | Server-side role checks on settings + invites |
| Image uploads | Storage path `{user_id}/…`; no base64 in production |
| Stripe | Not connected |
