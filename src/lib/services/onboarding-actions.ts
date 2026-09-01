"use server";

import { getCurrentProfile } from "@/lib/services/actions";
import { trackEvent } from "@/lib/services/analytics";
import type { AnalyticsEventName } from "@findit/domain";

const SHOPPER_ONBOARDING_EVENTS = new Set<AnalyticsEventName>([
  "onboarding_started",
  "onboarding_completed",
  "pwa_install_clicked",
  "pwa_installed",
  "pwa_install_dismissed",
  "notifications_requested",
  "notifications_granted",
  "notifications_denied",
]);

/** Fire-and-forget shopper onboarding analytics. Never throws to the client. */
export async function trackShopperOnboardingEventAction(
  eventName: AnalyticsEventName
): Promise<{ ok: true }> {
  if (!SHOPPER_ONBOARDING_EVENTS.has(eventName)) return { ok: true };
  try {
    const profile = await getCurrentProfile();
    if (profile && profile.account_type !== "customer") return { ok: true };
    await trackEvent(eventName, { userId: profile?.id });
  } catch {
    // Analytics must never block onboarding.
  }
  return { ok: true };
}
