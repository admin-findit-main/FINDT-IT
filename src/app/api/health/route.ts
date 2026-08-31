import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "down" | "skipped" = "skipped";
  if (isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const { error } = await admin.from("billing_settings").select("id").limit(1);
      database = error ? "down" : "ok";
    } catch {
      database = "down";
    }
  }

  const ok = database !== "down";
  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      database,
    },
    { status: ok ? 200 : 503 }
  );
}
