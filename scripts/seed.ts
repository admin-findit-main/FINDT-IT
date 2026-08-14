/**
 * Seed helper for Supabase environments.
 *
 * Usage (with Supabase configured):
 *   npm run seed
 *
 * This script is intentionally conservative: it prints instructions and
 * validates env rather than writing production data by accident.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || process.env.FINDIT_DEMO_MODE === "true") {
    console.log("FINDIT seed");
    console.log("-----------");
    console.log("Supabase service role is missing, or FINDIT_DEMO_MODE=true.");
    console.log("");
    console.log("To seed a real Supabase project:");
    console.log("  1. Set FINDIT_DEMO_MODE=false");
    console.log("  2. Apply supabase/migrations/*.sql");
    console.log("  3. Create auth users in the Supabase dashboard");
    console.log("  4. Insert stores/requests using the service role");
    console.log("");
    console.log("Note: FINDIT_DEMO_MODE=true is for Vitest only — not for running the app.");
    return;
  }

  console.log("Supabase credentials detected.");
  console.log("Apply migrations first, then create auth users in the dashboard.");
  console.log("A full remote seed can be extended here once your project is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
