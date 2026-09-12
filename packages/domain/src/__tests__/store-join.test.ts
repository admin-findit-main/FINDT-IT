import { describe, expect, it } from "vitest";
import { formatEin, isValidEin, normalizeEin } from "../business";
import { storeJoinApplicationSchema } from "../validations";

const base = {
  ownerName: "Casey Owner",
  ownerEmail: "casey@testhardware.example",
  ownerPhone: "703-555-0111",
  legalName: "Test Hardware LLC",
  businessName: "Test Hardware Co",
  businessType: "Hardware" as const,
  streetAddress: "99 Main St",
  city: "Falls Church",
  state: "VA",
  postalCode: "22044",
  phone: "703-555-0111",
  website: "testhardware.example",
  requestCategories: ["Hardware"],
  requiresCustomerId: false,
  confirmedLegitimate: true,
};

describe("EIN helpers", () => {
  it("strips dashes and keeps nine digits", () => {
    expect(normalizeEin("12-3456789")).toBe("123456789");
    expect(formatEin("123456789")).toBe("12-3456789");
    expect(isValidEin("12-3456789")).toBe(true);
    expect(isValidEin("123")).toBe(false);
  });
});

describe("store join application", () => {
  it("accepts join without EIN", () => {
    const parsed = storeJoinApplicationSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ein).toBeNull();
      expect(parsed.data.legalName).toBe("Test Hardware LLC");
      expect(parsed.data.website).toBe("https://testhardware.example");
      expect(parsed.data.whyLegit.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("accepts a valid optional EIN", () => {
    const parsed = storeJoinApplicationSchema.safeParse({
      ...base,
      ein: "12-3456789",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ein).toBe("123456789");
    }
  });

  it("rejects a short EIN when provided", () => {
    const parsed = storeJoinApplicationSchema.safeParse({ ...base, ein: "12-345" });
    expect(parsed.success).toBe(false);
  });

  it("requires dispensaries to confirm customer ID checks", () => {
    const parsed = storeJoinApplicationSchema.safeParse({
      ...base,
      businessType: "Dispensary",
      requestCategories: ["Dispensary"],
      requiresCustomerId: false,
    });
    expect(parsed.success).toBe(false);
    expect(
      parsed.error?.issues.some((issue) => issue.path[0] === "requiresCustomerId")
    ).toBe(true);
  });
});
