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
