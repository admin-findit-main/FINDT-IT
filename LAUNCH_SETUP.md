# FINDIT — launch today (web)

App Store / Play cannot ship the same day (Apple enrollment + review). **Today's launch is the public web app on Vercel**, still in pilot mode (`FINDIT_PILOT_MODE=true`, no Stripe).

## Already running on this Mac

| Surface | URL |
|---------|-----|
| Web | http://localhost:3002 |
| Customer Expo Go | `exp://192.168.1.142:8081` (confirm current LAN IP) |
| Employee Expo Go | `exp://192.168.1.142:8082` |

## What you must do in a browser (I cannot log in for you)

1. Create / log into **Vercel** at https://vercel.com/signup (use **Pro** if you will charge stores; Hobby is not licensed for commercial use).
2. In this folder, run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
cd "/Applications/FINDIT!"
npx vercel login
npx vercel link --yes
```

3. Tell me when login succeeds. I will push env vars from `.env.local` (server-only keys stay in Vercel, not in git) and deploy production.

## After the first Vercel URL exists

In Supabase → Authentication → URL Configuration:

- **Site URL** = `https://<your-vercel-app>.vercel.app`
- **Redirect URLs** add:
  - `https://<your-vercel-app>.vercel.app/auth/callback`
  - `https://<your-vercel-app>.vercel.app/auth/update-password`

Then set `NEXT_PUBLIC_APP_URL` in Vercel to that same origin (no trailing slash) and redeploy so password-reset links match.

## Not today (cannot finish in one afternoon)

| Item | Why it waits |
|------|----------------|
| Apple Developer $99 | Identity verification can take hours to days; TestFlight after that |
| Google Play $25 | Identity check + 12-tester closed test (14 days) |
| Custom domain | Buy anytime; DNS must propagate |
| Stripe | Not implemented yet; keep pilot free |
| Resend SMTP | Free, but needs a verified domain; Supabase built-in mailer is 2 emails/hour |

## Env vars Vercel needs (names only)

From `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (optional fallback)
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive, server only)
- `NEXT_PUBLIC_APP_URL` (the Vercel HTTPS origin)
- `FINDIT_DEMO_MODE=false`
- `FINDIT_PILOT_MODE=true`
- `FINDIT_BYPASS_PLAN_LIMITS=false`

Do **not** set `FINDIT_DEV_ORIGIN` in production.
