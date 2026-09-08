import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey } from "@/lib/config/env";
import {
  INVALID_REWARDS_CLAIM_ERROR,
  claimPendingStoreRewards,
} from "@/lib/services/rewards-claim";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = getSupabasePublishableKey();
  if (!token || !url || !publishable) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const userClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let body: { phone?: unknown; code?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown; code?: unknown };
  } catch {
    return NextResponse.json(
      { error: INVALID_REWARDS_CLAIM_ERROR },
      { status: 400 }
    );
  }

  try {
    const result = await claimPendingStoreRewards({
      customerId: user.id,
      phone: typeof body.phone === "string" ? body.phone : "",
      code: typeof body.code === "string" ? body.code : "",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.reason === "rate_limited" ? 429 : 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      storeName: result.storeName,
      pointsBalance: result.pointsBalance,
    });
  } catch {
    return NextResponse.json(
      { error: "Store rewards could not be connected. Try again." },
      { status: 503 }
    );
  }
}
