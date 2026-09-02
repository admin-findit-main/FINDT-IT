"use server";

import {
  isAdminPushAudience,
  parseAdminPushCopy,
  type AdminPushAudience,
} from "@findit/domain";
import { isSoloAdmin } from "@/lib/auth/admin";
import { isDemoMode } from "@/lib/config/env";
import { logSecurityEvent } from "@/lib/security/audit";
import { getCurrentProfile } from "@/lib/services/actions";
import {
  assertAdminPushReady,
  countPushAudience,
  deliverAdminPush,
} from "@/lib/services/admin-push";
import type { AdminPushBroadcast } from "@/types/database";

export type AdminPushAudienceCounts = Record<
  AdminPushAudience,
  { people: number; devices: number }
>;

export async function getAdminPushPageDataAction(): Promise<{
  counts: AdminPushAudienceCounts;
  recent: AdminPushBroadcast[];
  configured: boolean;
  demo: boolean;
}> {
  const empty: AdminPushAudienceCounts = {
    all: { people: 0, devices: 0 },
    shoppers: { people: 0, devices: 0 },
    store_owners: { people: 0, devices: 0 },
    employees: { people: 0, devices: 0 },
  };
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) {
    return { counts: empty, recent: [], configured: false, demo: isDemoMode() };
  }
  if (isDemoMode()) {
    return { counts: empty, recent: [], configured: false, demo: true };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const [all, shoppers, store_owners, employees, recentRes] = await Promise.all([
    countPushAudience(admin, "all"),
    countPushAudience(admin, "shoppers"),
    countPushAudience(admin, "store_owners"),
    countPushAudience(admin, "employees"),
    admin
      .from("admin_push_broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    counts: { all, shoppers, store_owners, employees },
    recent: (recentRes.data || []) as AdminPushBroadcast[],
    configured: !assertAdminPushReady(),
    demo: false,
  };
}

export async function sendAdminPushBroadcastAction(input: {
  audience: string;
  title: string;
  body: string;
  url: string;
}): Promise<{ error?: string; sent?: number; pruned?: number; demo?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) {
    return { error: "Only the FINDIT operator can send broadcasts." };
  }
  if (!isAdminPushAudience(input.audience)) {
    return { error: "Choose who should receive this." };
  }
  const parsed = parseAdminPushCopy({
    title: input.title,
    body: input.body,
    url: input.url,
    audience: input.audience,
  });
  if ("error" in parsed) return parsed;
  if (isDemoMode()) {
    return { sent: 0, pruned: 0, demo: true };
  }
  const setupError = assertAdminPushReady();
  if (setupError) return { error: setupError };

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const result = await deliverAdminPush({
      admin,
      audience: input.audience,
      title: parsed.title,
      body: parsed.body,
      url: parsed.url,
    });
    await admin.from("admin_push_broadcasts").insert({
      sent_by: profile.id,
      audience: input.audience,
      title: parsed.title,
      body: parsed.body,
      destination_url: parsed.url,
      recipient_count: result.recipients,
      pruned_count: result.pruned,
    });
    void logSecurityEvent({
      actorId: profile.id,
      action: "admin_push_broadcast",
      resource: input.audience,
      metadata: {
        recipients: result.recipients,
        pruned: result.pruned,
        url: parsed.url,
      },
    });
    return { sent: result.recipients, pruned: result.pruned };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[FINDIT] admin push failed", message);
    return { error: "Could not send that notification. Try again." };
  }
}
