#!/usr/bin/env bash
# Quick check that FINDIT is configured for real Supabase (not demo).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local"
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env.local
set +a

ok=1
need() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "✗ $name is empty"
    ok=0
  else
    echo "✓ $name is set"
  fi
}

need NEXT_PUBLIC_SUPABASE_URL
need NEXT_PUBLIC_SUPABASE_ANON_KEY
need SUPABASE_SERVICE_ROLE_KEY
need NEXT_PUBLIC_APP_URL

if [[ "${FINDIT_DEMO_MODE:-}" != "false" ]]; then
  echo "✗ FINDIT_DEMO_MODE must be false (got: ${FINDIT_DEMO_MODE:-unset})"
  ok=0
else
  echo "✓ FINDIT_DEMO_MODE=false"
fi

if [[ "$ok" -ne 1 ]]; then
  echo ""
  echo "Fill the empty values in .env.local from Supabase → Project Settings → API"
  exit 1
fi

echo ""
echo "Env looks ready. Next:"
echo "  1. Apply all 4 SQL migrations in the Supabase SQL editor"
echo "  2. Auth → URL config: add \$NEXT_PUBLIC_APP_URL/auth/callback and .../auth/update-password"
echo "  3. npm run dev"
echo "  4. Sign up a real user, promote admin in SQL, approve a store from /join"
