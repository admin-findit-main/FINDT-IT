import { isDemoMode } from "@/lib/config/env";
import { requestOrigin } from "@/lib/security/request-log";

export async function logSecurityEvent(input: {
  actorId?: string | null;
  action: string;
  resource?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (isDemoMode()) return;
  try {
    const origin = await requestOrigin();
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    await admin.from("security_audit_events").insert({
      actor_id: input.actorId || null,
      action: input.action,
      resource: input.resource || null,
      ip: origin.ip || null,
      metadata: input.metadata || {},
    });
  } catch (error) {
    console.error("[FINDIT] audit log failed", {
      action: input.action,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
