import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { maskPhoneE164, normalizePhoneToE164 } from "@findit/domain";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSupabasePublishableKey } from "@/lib/config/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = getSupabasePublishableKey();
  if (!token || !url || !publishable) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const limited = await consumeRateLimit({
    bucket: "profile-phone",
    limit: 10,
    windowMs: 60 * 60_000,
    key: user.id,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let rawPhone = "";
  try {
    const body = (await request.json()) as { phone?: unknown };
    rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  } catch {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const parsed = rawPhone ? normalizePhoneToE164(rawPhone) : null;
  if (parsed && !parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const phoneE164 = parsed?.ok ? parsed.e164 : null;

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_type, phone_e164, phone_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.account_type !== "customer") {
    return NextResponse.json({ error: "Shopper account required." }, { status: 403 });
  }

  if (profile.phone_e164 === phoneE164) {
    return NextResponse.json({
      ok: true,
      phoneE164,
      maskedPhone: phoneE164 ? maskPhoneE164(phoneE164) : null,
      verified: Boolean(profile.phone_verified),
    });
  }

  const { error } = await admin
    .from("profiles")
    .update({
      phone_e164: phoneE164,
      phone_verified: false,
      phone_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    const message =
      error.code === "23505"
        ? "That phone number is already connected to another FINDIT account."
        : "Could not save that phone number.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  void logSecurityEvent({
    actorId: user.id,
    action: "shopper_phone_changed",
    resource: user.id,
    metadata: { removed: phoneE164 === null, verified: false, surface: "mobile" },
  });

  return NextResponse.json({
    ok: true,
    phoneE164,
    maskedPhone: phoneE164 ? maskPhoneE164(phoneE164) : null,
    verified: false,
  });
}
