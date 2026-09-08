import { describe, expect, it } from "vitest";
import {
  estimateHubPoints,
  formatHubAmount,
  MAX_HUB_AMOUNT_CENTS,
} from "@/lib/hub/amount";

describe("Hub purchase amounts", () => {
  it("formats integer cents as US dollars", () => {
    expect(formatHubAmount(0)).toBe("$0.00");
    expect(formatHubAmount(1)).toBe("$0.01");
    expect(formatHubAmount(123_456)).toBe("$1,234.56");
    expect(formatHubAmount(MAX_HUB_AMOUNT_CENTS)).toBe("$999,999.99");
  });

  it("clamps invalid and excessive values for display", () => {
    expect(formatHubAmount(-1)).toBe("$0.00");
    expect(formatHubAmount(Number.NaN)).toBe("$0.00");
    expect(formatHubAmount(MAX_HUB_AMOUNT_CENTS + 1)).toBe("$999,999.99");
  });

  it("estimates whole points using floor", () => {
    expect(estimateHubPoints(199, 1)).toBe(1);
    expect(estimateHubPoints(199, 3)).toBe(5);
    expect(estimateHubPoints(50, 1)).toBe(0);
    expect(estimateHubPoints(100, 0)).toBe(0);
  });
});
