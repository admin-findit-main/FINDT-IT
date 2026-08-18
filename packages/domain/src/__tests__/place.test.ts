import { describe, expect, it } from "vitest";
import {
  digitsPostalCode,
  formatShortPlace,
  isCompleteShortPlace,
  normalizeStateCode,
  parseCityLookup,
  parseReverseGeocode,
  parseZipLookup,
} from "../place";

describe("normalizeStateCode", () => {
  it("accepts abbreviations and names", () => {
    expect(normalizeStateCode("va")).toBe("VA");
    expect(normalizeStateCode("Virginia")).toBe("VA");
    expect(normalizeStateCode("DC")).toBe("DC");
    expect(normalizeStateCode("")).toBe("");
    expect(normalizeStateCode("ZZ")).toBe("");
  });
});

describe("formatShortPlace", () => {
  it("prints city, ST ZIP without a street", () => {
    expect(
      formatShortPlace({
        city: "Falls Church",
        state: "VA",
        postalCode: "22044",
      })
    ).toBe("Falls Church, VA 22044");
    expect(formatShortPlace({ city: "Falls Church", state: "Virginia" })).toBe(
      "Falls Church, VA"
    );
    expect(formatShortPlace({ postalCode: "22044-1234" })).toBe("22044");
  });
});

describe("isCompleteShortPlace", () => {
  it("requires city, state, and ZIP", () => {
    expect(
      isCompleteShortPlace({ city: "Stovall", state: "NC", postalCode: "27582" })
    ).toBe(true);
    expect(
      isCompleteShortPlace({ city: "", state: "VA", postalCode: "22044" })
    ).toBe(false);
    expect(
      isCompleteShortPlace({ city: "  ", state: "NC", postalCode: "27582" })
    ).toBe(false);
  });
});

describe("zip lookup parsers", () => {
  it("reads a ZIP payload", () => {
    expect(
      parseZipLookup({
        "post code": "22044",
        places: [
          {
            "place name": "Falls Church",
            "state abbreviation": "VA",
            state: "Virginia",
          },
        ],
      })
    ).toEqual({ city: "Falls Church", state: "VA", postalCode: "22044" });
  });

  it("reads city ZIP options", () => {
    const places = parseCityLookup(
      {
        places: [
          { "place name": "Falls Church", "post code": "22042", "state abbreviation": "VA" },
          { "place name": "Falls Church", "post code": "22044", "state abbreviation": "VA" },
        ],
      },
      "VA"
    );
    expect(places.map((p) => p.postalCode)).toEqual(["22042", "22044"]);
  });

  it("strips ZIP to five digits", () => {
    expect(digitsPostalCode("22044-8910")).toBe("22044");
  });
});

describe("parseReverseGeocode", () => {
  it("reads a US GPS payload into city, state, ZIP", () => {
    expect(
      parseReverseGeocode({
        countryCode: "US",
        principalSubdivision: "Virginia",
        principalSubdivisionCode: "US-VA",
        city: "Falls Church",
        locality: "Falls Church",
        postcode: "22044-1234",
      })
    ).toEqual({ city: "Falls Church", state: "VA", postalCode: "22044" });
  });

  it("rejects non-US results", () => {
    expect(
      parseReverseGeocode({
        countryCode: "CA",
        city: "Toronto",
        postcode: "M5V",
      })
    ).toBeNull();
  });
});
