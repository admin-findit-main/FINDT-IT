export const MAX_HUB_AMOUNT_CENTS = 99_999_999;

export function formatHubAmount(amountCents: number): string {
  const safeCents = Number.isFinite(amountCents)
    ? Math.max(0, Math.min(MAX_HUB_AMOUNT_CENTS, Math.trunc(amountCents)))
    : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeCents / 100);
}

export function estimateHubPoints(
  amountCents: number,
  pointsPerDollar: number
): number {
  if (
    !Number.isFinite(amountCents) ||
    !Number.isFinite(pointsPerDollar) ||
    amountCents <= 0 ||
    pointsPerDollar <= 0
  ) {
    return 0;
  }
  return Math.floor(
    (Math.min(MAX_HUB_AMOUNT_CENTS, Math.trunc(amountCents)) *
      Math.trunc(pointsPerDollar)) /
      100
  );
}

/** Copy for Hub success when the purchase confirmed but no points were earned. */
export function hubZeroPointsCopy(input: {
  rewardsEnabled: boolean;
  amountCents: number;
  pointsPerDollar: number;
}): { headline: string; reason: string } {
  if (!input.rewardsEnabled) {
    return {
      headline: "No points awarded",
      reason: "Rewards are turned off for this store.",
    };
  }
  const rate = Math.trunc(input.pointsPerDollar);
  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      headline: "No points awarded",
      reason: "Rewards are turned off for this store.",
    };
  }
  if (estimateHubPoints(input.amountCents, rate) === 0) {
    return {
      headline: "No points awarded",
      reason: "Amount was under $1, so no full point was earned.",
    };
  }
  return {
    headline: "No points awarded",
    reason: "No points were added for this purchase.",
  };
}
