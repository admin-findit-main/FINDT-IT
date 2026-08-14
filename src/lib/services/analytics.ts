/**
 * Internal analytics event tracking (database only — no third-party).
 */

import { isDemoMode } from "@/lib/config/env";
import {
  ANALYTICS_EVENTS,
  buildAnalyticsEvent,
  type AnalyticsEventName,
} from "@findit/domain";

export { ANALYTICS_EVENTS, buildAnalyticsEvent, type AnalyticsEventName };

export async function trackEvent(
  eventName: AnalyticsEventName,
  meta?: {
    userId?: string | null;
    storeId?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    if (isDemoMode()) {
      const { getDemoState } = await import("@/lib/demo/store");
      getDemoState().events.push({
        event_name: eventName,
        user_id: meta?.userId || undefined,
        store_id: meta?.storeId || undefined,
        request_id: meta?.requestId || undefined,
        created_at: new Date().toISOString(),
      });
      return;
    }
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const row = buildAnalyticsEvent(eventName, meta);
    await admin.from("analytics_events").insert({
      event_name: row.event_name,
      user_id: row.user_id,
      store_id: row.store_id,
      request_id: row.request_id,
      metadata: row.metadata,
    });
  } catch {
    // Never block product flows on analytics
  }
}
