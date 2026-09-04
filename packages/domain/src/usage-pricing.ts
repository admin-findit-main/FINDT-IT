/** FINDIT store usage pricing. Amounts are integer cents. Charging stays off until launch. */

export const DEFAULT_USAGE_PRICING = {
  baseMonthlyCents: 1899,
  visitCents: 25,
  paygMaxVisits: 320,
  paygMaxCents: 9900,
  growthMinVisits: 321,
  growthMaxVisits: 1000,
  growthMonthlyCents: 12900,
  businessMinVisits: 1001,
  businessMaxVisits: 2500,
  businessMonthlyCents: 19900,
  highVolumeMinVisits: 2501,
  highVolumeMaxVisits: 5000,
  highVolumeMonthlyCents: 29900,
  enterpriseMinVisits: 5001,
  trialDays: 30,
  employeePoolPercent: 15,
  employeePoolMaxCents: null as number | null,
  employeePoolEnabled: true,
  shopperPointsPerVisit: 5,
  employeePointsPerVisit: 10,
  shopperMaxRewardedCheckinsPerDay: 3,
} as const;

export type UsagePricingConfig = {
  baseMonthlyCents: number;
  visitCents: number;
  paygMaxVisits: number;
  paygMaxCents: number;
  growthMinVisits: number;
  growthMaxVisits: number;
  growthMonthlyCents: number;
  businessMinVisits: number;
  businessMaxVisits: number;
  businessMonthlyCents: number;
  highVolumeMinVisits: number;
  highVolumeMaxVisits: number;
  highVolumeMonthlyCents: number;
  enterpriseMinVisits: number;
  trialDays: number;
  employeePoolPercent: number;
  employeePoolMaxCents: number | null;
  employeePoolEnabled: boolean;
  shopperPointsPerVisit: number;
  employeePointsPerVisit: number;
  shopperMaxRewardedCheckinsPerDay: number;
};

export type UsageTierId =
  | "payg"
  | "growth"
  | "business"
  | "high_volume"
  | "enterprise";

export type UsageTierKind = "payg" | "flat" | "contact";

export type UsageTier = {
  id: UsageTierId;
  name: string;
  kind: UsageTierKind;
  minVisits: number;
  maxVisits: number | null;
  monthlyCents: number | null;
};

export function usageTiers(config: UsagePricingConfig = DEFAULT_USAGE_PRICING): UsageTier[] {
  return [
    {
      id: "payg",
      name: "Pay As You Grow",
      kind: "payg",
      minVisits: 0,
      maxVisits: config.paygMaxVisits,
      monthlyCents: null,
    },
    {
      id: "growth",
      name: "Growth",
      kind: "flat",
      minVisits: config.growthMinVisits,
      maxVisits: config.growthMaxVisits,
      monthlyCents: config.growthMonthlyCents,
    },
    {
      id: "business",
      name: "Business",
      kind: "flat",
      minVisits: config.businessMinVisits,
      maxVisits: config.businessMaxVisits,
      monthlyCents: config.businessMonthlyCents,
    },
    {
      id: "high_volume",
      name: "High Volume",
      kind: "flat",
      minVisits: config.highVolumeMinVisits,
      maxVisits: config.highVolumeMaxVisits,
      monthlyCents: config.highVolumeMonthlyCents,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      kind: "contact",
      minVisits: config.enterpriseMinVisits,
      maxVisits: null,
      monthlyCents: null,
    },
  ];
}

export function tierForVisits(
  visits: number,
  config: UsagePricingConfig = DEFAULT_USAGE_PRICING
): UsageTier {
  const count = Math.max(0, Math.floor(visits));
  const tiers = usageTiers(config);
  const match = [...tiers].reverse().find((tier) => count >= tier.minVisits);
  return match || tiers[0];
}

export function quoteUsageBill(
  visits: number,
  config: UsagePricingConfig = DEFAULT_USAGE_PRICING
): {
  visits: number;
  tier: UsageTier;
  estimatedCents: number;
  billedCents: number;
  contactSales: boolean;
  nextTier: UsageTier | null;
  visitsUntilNextTier: number | null;
  effectiveCentsPerVisit: number | null;
  paygLine: { baseCents: number; usageCents: number; capped: boolean } | null;
} {
  const count = Math.max(0, Math.floor(visits));
  const tier = tierForVisits(count, config);
  const tiers = usageTiers(config);
  const nextIndex = tiers.findIndex((row) => row.id === tier.id) + 1;
  const nextTier = tiers[nextIndex] || null;
  const visitsUntilNextTier =
    nextTier && nextTier.minVisits > count ? nextTier.minVisits - count : null;

  let estimatedCents = 0;
  let paygLine: { baseCents: number; usageCents: number; capped: boolean } | null =
    null;
  if (tier.kind === "payg") {
    const usageCents = count * config.visitCents;
    const raw = config.baseMonthlyCents + usageCents;
    const capped = raw > config.paygMaxCents;
    estimatedCents = Math.min(raw, config.paygMaxCents);
    paygLine = {
      baseCents: config.baseMonthlyCents,
      usageCents,
      capped,
    };
  } else if (tier.kind === "flat" && tier.monthlyCents != null) {
    estimatedCents = tier.monthlyCents;
  }

  return {
    visits: count,
    tier,
    estimatedCents,
    billedCents: estimatedCents,
    contactSales: tier.kind === "contact",
    nextTier,
    visitsUntilNextTier,
    effectiveCentsPerVisit: count > 0 ? Math.round(estimatedCents / count) : null,
    paygLine,
  };
}

export function formatCents(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function utcMonthPeriod(at = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start, end };
}

export function monthLabelUtc(at = new Date()): string {
  return at.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function mergeUsagePricing(
  row: Partial<UsagePricingConfig> | null | undefined
): UsagePricingConfig {
  return { ...DEFAULT_USAGE_PRICING, ...row };
}
