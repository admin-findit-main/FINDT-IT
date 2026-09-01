import { describe, expect, it } from "vitest";
import {
  digitsPostalCode,
  formatCityState,
  formatShortPlace,
  isCompleteShortPlace,
  normalizeStateCode,
  normalizeStoreLocation,
  parseCityLookup,
  parsePhotonStreetFeatures,
  parseReverseGeocode,
  parseZipLookup,
  splitUsMailingAddress,
  streetLineOnly,
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
  it("appends ZIP to the city people already know", () => {
    expect(
      formatShortPlace({
        city: "Falls Church",
        state: "VA",
        postalCode: "22044",
      })
    ).toBe("Falls Church, VA 22044");
    expect(formatCityState({ city: "Falls Church", state: "Virginia" })).toBe(
      "Falls Church, VA"
    );
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

  it("reads ZIP centroid coordinates when present", () => {
    expect(
      parseZipLookup({
        "post code": "20001",
        places: [
          {
            "place name": "Washington",
            "state abbreviation": "DC",
            latitude: "38.9102",
            longitude: "-77.0170",
          },
        ],
      })
    ).toEqual({
      city: "Washington",
      state: "DC",
      postalCode: "20001",
      latitude: 38.9102,
      longitude: -77.017,
    });
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

describe("streetLineOnly", () => {
  it("keeps the street and drops city, state, ZIP", () => {
    expect(
      streetLineOnly("123 Main St, Falls Church, VA 22046", {
        city: "Falls Church",
        state: "VA",
        postalCode: "22046",
      })
    ).toBe("123 Main St");
    expect(
      streetLineOnly("123 Main St", {
        city: "Falls Church",
        state: "VA",
        postalCode: "22046",
      })
    ).toBe("123 Main St");
  });
});

describe("splitUsMailingAddress", () => {
  it("splits a pasted US mailing line", () => {
    expect(splitUsMailingAddress("123 Main St, Falls Church, VA 22046")).toEqual({
      street: "123 Main St",
      city: "Falls Church",
      state: "VA",
      postalCode: "22046",
    });
    expect(splitUsMailingAddress("123 Main St")).toBeNull();
  });
});

describe("normalizeStoreLocation", () => {
  it("never persists the full formatted address as the street", () => {
    expect(
      normalizeStoreLocation({
        streetAddress: "123 Main St, Falls Church, VA 22046",
        city: "",
        state: "",
        postalCode: "",
      })
    ).toEqual({
      street: "123 Main St",
      city: "Falls Church",
      state: "VA",
      postalCode: "22046",
    });
  });
});

describe("parsePhotonStreetFeatures", () => {
  it("returns street separately from city/state/ZIP", () => {
    const rows = parsePhotonStreetFeatures({
      features: [
        {
          properties: {
            housenumber: "123",
            street: "Main St",
            city: "Falls Church",
            state: "Virginia",
            postcode: "22046",
            countrycode: "US",
          },
        },
      ],
    });
    expect(rows).toEqual([
      {
        street: "123 Main St",
        city: "Falls Church",
        state: "VA",
        postalCode: "22046",
        label: "123 Main St · Falls Church, VA 22046",
      },
    ]);
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
