/**
 * Shared analytics event names + client-safe helpers.
 * Persistence uses Edge/service role on server; mobile inserts via RLS or Edge.
 */

export const ANALYTICS_EVENTS = [
  "signup_completed",
  "request_created",
  "request_routed",
  "store_request_opened",
  "store_response_created",
  "customer_viewed_response",
  "directions_clicked",
  "directions_tapped",
  "response_submitted",
  "response_time",
  "request_fulfilled",
  "request_expired",
  "request_still_looking",
  "store_application_submitted",
  "store_application_approved",
  "store_application_needs_info",
  "pilot_feedback_submitted",
  "push_token_registered",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsEventPayload = {
  event_name: AnalyticsEventName;
  user_id?: string | null;
  store_id?: string | null;
  request_id?: string | null;
  metadata?: Record<string, unknown>;
};

/** Build a row suitable for `analytics_events` insert. */
export function buildAnalyticsEvent(
  eventName: AnalyticsEventName,
  meta?: {
    userId?: string | null;
    storeId?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
  }
): AnalyticsEventPayload {
  return {
    event_name: eventName,
    user_id: meta?.userId ?? null,
    store_id: meta?.storeId ?? null,
    request_id: meta?.requestId ?? null,
    metadata: meta?.metadata ?? {},
  };
}
