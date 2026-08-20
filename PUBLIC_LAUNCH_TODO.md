# FINDIT — Public launch TODO

Last updated for post-pilot readiness. The app is ready for **closed pilot / heavy testing** with role-aware UX (customer · owner · employee · admin). Use this list for what is still **not** required for pilot but **is** required before a public launch.

---

## Already good for pilot testing

- [x] Real Supabase (demo mode off)
- [x] Role-aware login homes (`/home`, `/store`, `/admin`)
- [x] Distinct store nav for owner/manager vs employee
- [x] Store account + invite accept (`/invite/[token]`)
- [x] Admin approve stores + pilot funnel (`/admin`)
- [x] Customer ask → route → respond → found / still looking
- [x] Landing / login / signup copy that separates shoppers, stores, and staff

---

## Before public launch

### Product & payments
- [ ] Stripe checkout for FINDIT+ (customers) and store Starter/Pro plans
- [ ] Trial-end emails and paywall when `trial_ends_at` passes
- [ ] Clear in-app upgrade paths (remove “pilot limits off” messaging)
- [ ] Multi-location owner UX if stores will have more than one location

### Trust & legal
- [ ] Attorney-reviewed Privacy, Terms, Acceptable Use, Business Terms
- [ ] Cookie / analytics disclosure if you add analytics
- [ ] Account deletion flow (self-serve or verified support process)
- [ ] Business verification policy (beyond manual admin approve)

### Communications
- [ ] Transactional email (Resend or similar): invite, approval, new request, stock reply
- [ ] Optional SMS / push for store new-request alerts
- [ ] Customer email when a store replies (if not in-app only)

### Reliability & ops
- [ ] Production deploy (Vercel) + custom domain + HTTPS
- [ ] `NEXT_PUBLIC_APP_URL` = production URL; Auth redirect URLs updated in Supabase
- [ ] Staging environment separate from production
- [ ] Error monitoring (e.g. Sentry) and uptime checks
- [ ] Backup / retention policy for Supabase
- [ ] Rate limiting / abuse controls on ask + join + invite
- [ ] Confirm all RLS policies without relying on service-role inserts where possible

### Growth & support
- [ ] Public marketing site polish (beyond MVP landing)
- [ ] Support email / help page for customers and stores
- [ ] Onboarding checklist email for newly approved stores
- [ ] Admin tools: suspend store, search users, export demand CSV

### App distribution (later than web launch)
- [ ] PWA install polish / icons audit
- [ ] App Store / Play only if you need native wrappers (not required for web pilot)
- [ ] Apple Pay / Google Pay via Stripe when charging

### Security & compliance
- [ ] Rotate any keys that were shared in chat or committed locally
- [ ] Review `.env` secrets never in client bundles
- [ ] Penetration / RLS audit on customer_requests, store_responses, storage
- [ ] Age / prohibited products policy enforcement if needed

---

## Pilot testing cheat sheet (for you)

| Who | How they enter | Where they land |
|-----|----------------|-----------------|
| Customer | `/signup` | `/home` |
| Store owner | `/join` → you approve on `/admin` | `/store` (full nav) |
| Employee | Owner **Team** invite link | `/store` (slim nav) |
| You (admin) | `ceo@askfindit.com` | `/admin` |

**Rule:** log out between roles when testing. Same browser session = one account.

---

## Nice-to-have (after launch)

- [ ] Saved searches / “notify me if stocked later”
- [ ] Store public profile polish
- [ ] Better distance (true geo) vs ZIP heuristics
- [ ] i18n / additional markets
