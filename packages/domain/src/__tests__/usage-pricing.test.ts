import { describe, expect, it } from "vitest";
import {
  DEFAULT_USAGE_PRICING,
  formatCents,
  quoteUsageBill,
  tierForVisits,
} from "../usage-pricing";

describe("usage pricing", () => {
  it("matches the September trial example of 143 visits", () => {
    const quote = quoteUsageBill(143);
    expect(quote.tier.id).toBe("payg");
    expect(quote.estimatedCents).toBe(5474);
    expect(formatCents(quote.estimatedCents)).toBe("$54.74");
    expect(quote.visitsUntilNextTier).toBe(178);
  });

  it("caps pay-as-you-grow at $99", () => {
    const atBoundary = quoteUsageBill(320);
    expect(atBoundary.estimatedCents).toBe(9899);
    expect(atBoundary.paygLine?.capped).toBe(false);
    const forcedCap = quoteUsageBill(400, {
      ...DEFAULT_USAGE_PRICING,
      paygMaxVisits: 500,
      growthMinVisits: 501,
    });
    expect(forcedCap.estimatedCents).toBe(DEFAULT_USAGE_PRICING.paygMaxCents);
    expect(forcedCap.paygLine?.capped).toBe(true);
    expect(quoteUsageBill(321).tier.id).toBe("growth");
    expect(quoteUsageBill(321).estimatedCents).toBe(12900);
  });

  it("does not invent a charge for enterprise volume", () => {
    const quote = quoteUsageBill(5001);
    expect(quote.tier.id).toBe("enterprise");
    expect(quote.contactSales).toBe(true);
    expect(quote.estimatedCents).toBe(0);
  });

  it("picks the named tiers", () => {
    expect(tierForVisits(0).id).toBe("payg");
    expect(tierForVisits(1000).id).toBe("growth");
    expect(tierForVisits(1001).id).toBe("business");
    expect(tierForVisits(2501).id).toBe("high_volume");
  });
});
