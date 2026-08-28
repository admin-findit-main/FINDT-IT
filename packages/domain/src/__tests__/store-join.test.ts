import { describe, expect, it } from "vitest";
import { formatEin, isValidEin, normalizeEin } from "../business";
import { storeJoinApplicationSchema } from "../validations";

const base = {
  ownerName: "Casey Owner",
  ownerEmail: "casey@testhardware.example",
  ownerPhone: "703-555-0111",
  password: "Riverstone-49",
  confirmPassword: "Riverstone-49",
  legalName: "Test Hardware LLC",
  ein: "12-3456789",
  entityType: "LLC" as const,
  businessName: "Test Hardware Co",
  businessType: "Hardware" as const,
  streetAddress: "99 Main St",
  city: "Falls Church",
  state: "VA",
  postalCode: "22044",
  phone: "703-555-0111",
  website: "testhardware.example",
  whyLegit: "Licensed hardware retailer operating on Main Street for five years.",
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
  it("requires EIN, legal name, and entity type", () => {
    const parsed = storeJoinApplicationSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ein).toBe("123456789");
      expect(parsed.data.website).toBe("https://testhardware.example");
    }
  });

  it("rejects a short EIN", () => {
    const parsed = storeJoinApplicationSchema.safeParse({ ...base, ein: "12-345" });
    expect(parsed.success).toBe(false);
  });
});
