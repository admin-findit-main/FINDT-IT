import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAccountDeletionConfirmed } from "@findit/domain";
import { isSoloAdmin } from "@/lib/auth/admin";
import { purgeFinditAccount } from "@/lib/account/purge";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { toPublicError } from "@/lib/security/public-error";
import { getSupabasePublishableKey } from "@/lib/config/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await consumeRateLimit({
    bucket: "account-delete",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  let confirmation = "";
  try {
    const body = (await request.json()) as { confirmation?: string };
    confirmation = String(body.confirmation || "");
  } catch {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  if (!isAccountDeletionConfirmed(confirmation)) {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = getSupabasePublishableKey();
  if (!token || !url || !anon) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("email, account_type")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const purged = await purgeFinditAccount({
      userId: user.id,
      isOperator: isSoloAdmin(profile),
      accessToken: token,
    });
    if (purged.error) {
      return NextResponse.json({ error: purged.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: toPublicError(error, "Could not delete this account.") },
      { status: 500 }
    );
  }
}
