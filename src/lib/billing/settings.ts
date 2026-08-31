import { cache } from "react";
import {
  DEFAULT_BILLING_ACCESS_RULES,
  launchChecklistComplete,
  type BillingAccessRules,
  type BillingLaunchCheckId,
} from "@findit/domain";
import type { BillingSettings } from "@/types/database";
import { isDemoMode, isFastSpringLiveMode } from "@/lib/config/env";

const EMPTY_SETTINGS: BillingSettings = {
  id: 1,
  billing_required: false,
  shopper_billing_required: false,
  live_billing_approved: false,
  live_billing_approved_at: null,
  live_billing_approved_by: null,
  allow_past_due_access: true,
  allow_failed_payment_access: true,
  allow_pending_payment_access: true,
  launch_checklist: {},
  updated_at: new Date(0).toISOString(),
};

export const getBillingSettings = cache(async (): Promise<BillingSettings> => {
  if (isDemoMode()) return EMPTY_SETTINGS;
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { data } = await admin
      .from("billing_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return EMPTY_SETTINGS;
    return {
      ...EMPTY_SETTINGS,
      ...data,
      launch_checklist: (data.launch_checklist || {}) as Record<string, boolean>,
    };
  } catch {
    return EMPTY_SETTINGS;
  }
});

export function accessRulesFromSettings(
  settings: BillingSettings
): BillingAccessRules {
  return {
    billingRequired: settings.billing_required,
    allowPastDueAccess: settings.allow_past_due_access,
    allowFailedPaymentAccess: settings.allow_failed_payment_access,
    allowPendingPaymentAccess: settings.allow_pending_payment_access,
  };
}

export function liveChargesAllowed(settings: BillingSettings): boolean {
  return (
    isFastSpringLiveMode() &&
    settings.live_billing_approved &&
    launchChecklistComplete(
      settings.launch_checklist as Partial<Record<BillingLaunchCheckId, boolean>>
    )
  );
}
