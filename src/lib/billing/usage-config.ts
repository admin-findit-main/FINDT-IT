import type { UsagePricingConfig } from "@findit/domain";
import { DEFAULT_USAGE_PRICING, mergeUsagePricing } from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import type { FinditBillingConfig } from "@/types/database";

export function configFromRow(row: FinditBillingConfig | null): UsagePricingConfig {
  if (!row) return DEFAULT_USAGE_PRICING;
  return mergeUsagePricing({
    baseMonthlyCents: row.base_monthly_cents,
    visitCents: row.visit_cents,
    paygMaxVisits: row.payg_max_visits,
    paygMaxCents: row.payg_max_cents,
    growthMinVisits: row.growth_min_visits,
    growthMaxVisits: row.growth_max_visits,
    growthMonthlyCents: row.growth_monthly_cents,
    businessMinVisits: row.business_min_visits,
    businessMaxVisits: row.business_max_visits,
    businessMonthlyCents: row.business_monthly_cents,
    highVolumeMinVisits: row.high_volume_min_visits,
    highVolumeMaxVisits: row.high_volume_max_visits,
    highVolumeMonthlyCents: row.high_volume_monthly_cents,
    enterpriseMinVisits: row.enterprise_min_visits,
    trialDays: row.trial_days,
    employeePoolPercent: Number(row.employee_pool_percent),
    employeePoolMaxCents: row.employee_pool_max_cents,
    employeePoolEnabled: row.employee_pool_enabled,
    shopperPointsPerVisit: row.shopper_points_per_visit,
    employeePointsPerVisit: row.employee_points_per_visit,
    shopperMaxRewardedCheckinsPerDay: row.shopper_max_rewarded_checkins_per_day,
  });
}

export async function loadUsagePricing(): Promise<UsagePricingConfig> {
  if (isDemoMode()) return DEFAULT_USAGE_PRICING;
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { data } = await admin
      .from("findit_billing_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return configFromRow((data as FinditBillingConfig | null) || null);
  } catch {
    return DEFAULT_USAGE_PRICING;
  }
}
