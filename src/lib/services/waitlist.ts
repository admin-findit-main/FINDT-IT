"use server";

import { isDemoMode } from "@/lib/config/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export type WaitlistAudience = "shopper" | "store";

export type JoinWaitlistResult =
  | { ok: true; already?: boolean }
  | { error: string };

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function joinWaitlistAction(input: {
  email: string;
  audience: WaitlistAudience;
  name?: string;
  storeName?: string;
  /** Honeypot — bots fill this; humans never see it. */
  company?: string;
}): Promise<JoinWaitlistResult> {
  if (input.company?.trim()) {
    return { ok: true };
  }

  const email = input.email.trim().toLowerCase();
  const audience = input.audience;
  if (audience !== "shopper" && audience !== "store") {
    return { error: "Choose shopper or store." };
  }
  if (!looksLikeEmail(email)) {
    return { error: "Enter a valid email." };
  }

  const displayName = input.name?.trim().slice(0, 80) || null;
  const storeName =
    audience === "store" ? input.storeName?.trim().slice(0, 120) || null : null;

  const limited = await consumeRateLimit({
    bucket: "waitlist",
    limit: 8,
    windowMs: 60 * 60_000,
    key: email,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) return { ok: true };

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { error } = await admin.from("waitlist_signups").insert({
      email,
      audience,
      display_name: displayName,
      store_name: storeName,
    });
    if (error) {
      if (error.code === "23505") return { ok: true, already: true };
      console.error("[FINDIT] waitlist insert failed", error.message);
      return { error: "Couldn’t join the waitlist. Try again in a moment." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[FINDIT] waitlist unavailable", err);
    return { error: "Couldn’t join the waitlist. Try again in a moment." };
  }
}
