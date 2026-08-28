import { describe, expect, it } from "vitest";
import { classifyRequest, matchKindForStore } from "../classify";

describe("classifyRequest", () => {
  it("routes Geek Bar to smoke shop vapes with high confidence", () => {
    const result = classifyRequest({ productName: "Need Geek Bar Miami Mint" });
    expect(result.status).toBe("confident");
    expect(result.businessTypeId).toBe("smoke_shop");
    expect(result.categoryId).toBe("vapes");
    expect(result.matchedKeywords.join(" ")).toMatch(/geek bar/i);
  });

  it("routes brake pads to auto parts", () => {
    const result = classifyRequest({
      productName: "I need brake pads for a 2018 Honda Accord",
    });
    expect(result.businessTypeId).toBe("auto_parts");
    expect(result.categoryId).toBe("brakes");
    expect(result.status).toBe("confident");
  });

  it("does not treat a lone battery as auto parts", () => {
    const result = classifyRequest({ productName: "battery" });
    expect(result.status).toBe("needs_confirm");
  });

  it("uses surrounding words for a Honda battery", () => {
    const result = classifyRequest({ productName: "battery for Honda Civic" });
    expect(result.businessTypeId).toBe("auto_parts");
    expect(result.categoryId).toBe("auto_batteries");
  });

  it("routes 18650 vape battery to smoke shops", () => {
    const result = classifyRequest({ productName: "18650 vape battery" });
    expect(result.businessTypeId).toBe("smoke_shop");
  });

  it("accepts a customer-confirmed category", () => {
    const result = classifyRequest({
      productName: "something odd",
      category: "Coffee",
      confirmed: true,
    });
    expect(result.status).toBe("confident");
    expect(result.businessTypeId).toBe("coffee_shop");
  });
});

describe("matchKindForStore", () => {
  it("prefers keyword matches over category", () => {
    const classification = classifyRequest({ productName: "Geek Bar" });
    expect(
      matchKindForStore({
        classification,
        store: {
          businessTypeId: "smoke_shop",
          catalogCategoryIds: ["vapes"],
          catalogKeywordIds: ["geek_bar"],
        },
      })
    ).toBe("keyword");
  });
});
