"use server";

import { boundUuid } from "@findit/domain";
import { isSoloAdmin } from "@/lib/auth/admin";
import { isDemoMode } from "@/lib/config/env";
import { logSecurityEvent } from "@/lib/security/audit";
import { getCurrentProfile } from "@/lib/services/actions";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) return null;
  return profile;
}

export type AdminWaitlistRow = {
  id: string;
  email: string;
  audience: string;
  display_name: string | null;
  store_name: string | null;
  created_at: string;
};

export async function getAdminWaitlistAction(): Promise<AdminWaitlistRow[]> {
  if (!(await requireAdmin())) return [];
  if (isDemoMode()) return [];

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("waitlist_signups")
    .select("id, email, audience, display_name, store_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data || []) as AdminWaitlistRow[];
}

export async function resolveAdminReportAction(
  reportId: string,
  status: "resolved" | "dismissed" | "pending"
) {
  const profile = await requireAdmin();
  if (!profile) return { error: "Unauthorized" };
  const id = boundUuid(reportId);
  if (!id) return { error: "Invalid report" };
  if (isDemoMode()) return { ok: true as const };

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin.from("reports").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  await logSecurityEvent({
    actorId: profile.id,
    action: "admin.report.resolve",
    resource: id,
    metadata: { status },
  });
  return { ok: true as const };
}

export async function adminRevokeHubDeviceAction(deviceId: string) {
  const profile = await requireAdmin();
  if (!profile) return { error: "Unauthorized" };
  const id = boundUuid(deviceId);
  if (!id) return { error: "Invalid device" };
  if (isDemoMode()) return { ok: true as const };

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin
    .from("store_devices")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) return { error: error.message };

  await logSecurityEvent({
    actorId: profile.id,
    action: "admin.hub.revoke",
    resource: id,
  });
  return { ok: true as const };
}

export async function getAdminSystemHealthAction() {
  if (!(await requireAdmin())) return null;
  const started = Date.now();
  let database: "ok" | "error" | "demo" = "demo";
  let dbMs: number | null = null;

  if (!isDemoMode()) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const t0 = Date.now();
      const { error } = await admin.from("profiles").select("id").limit(1);
      dbMs = Date.now() - t0;
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }

  return {
    database,
    dbMs,
    totalMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  };
}
