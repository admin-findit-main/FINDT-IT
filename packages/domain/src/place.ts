export type ShortPlace = {
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
};

/** Parse a finite lat/lng value from GPS, ZIP lookup, or a numeric DB column. */
export function parseGeoCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export type UsStateCode = (typeof US_STATES)[number]["code"];

const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));
const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));

export function digitsPostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function isUsZip(value: string): boolean {
  return /^\d{5}$/.test(digitsPostalCode(value)) && digitsPostalCode(value).length === 5;
}

export function normalizeStateCode(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (STATE_BY_CODE.has(upper as UsStateCode)) return upper;
  const named = STATE_BY_NAME.get(raw.toLowerCase());
  return named?.code || "";
}

export function stateName(code: string): string {
  return STATE_BY_CODE.get(normalizeStateCode(code) as UsStateCode)?.name || code;
}

/** City, ST — what people know, without the ZIP. */
export function formatCityState(place: {
  city?: string | null;
  state?: string | null;
}): string {
  const city = (place.city || "").trim();
  const state = normalizeStateCode(place.state);
  if (city && state) return `${city}, ${state}`;
  return city || state || "";
}

/** City, ST ZIP — ZIP is appended so you can see it without having to type it. */
export function formatShortPlace(place: {
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string {
  const cityState = formatCityState(place);
  const zip = digitsPostalCode(place.postalCode || "");
  if (cityState && zip) return `${cityState} ${zip}`;
  return cityState || zip;
}

export function emptyShortPlace(): ShortPlace {
  return { city: "", state: "", postalCode: "" };
}

export function isCompleteShortPlace(place: ShortPlace): boolean {
  return (
    place.city.trim().length >= 2 &&
    normalizeStateCode(place.state).length === 2 &&
    isUsZip(place.postalCode)
  );
}

export function shortPlaceFromProfile(profile: {
  default_city?: string | null;
  default_state?: string | null;
  default_postal_code?: string | null;
} | null | undefined): ShortPlace {
  return {
    city: (profile?.default_city || "").trim(),
    state: normalizeStateCode(profile?.default_state) || "VA",
    postalCode: digitsPostalCode(profile?.default_postal_code || ""),
  };
}

type ZippoPlace = {
  "place name"?: string;
  state?: string;
  "state abbreviation"?: string;
  latitude?: string;
  longitude?: string;
};

type ZippoPayload = {
  "post code"?: string;
  places?: ZippoPlace[];
};

export function parseZipLookup(payload: unknown, fallbackZip = ""): ShortPlace | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as ZippoPayload;
  const first = data.places?.[0];
  if (!first) return null;
  const state = normalizeStateCode(first["state abbreviation"] || first.state);
  const city = (first["place name"] || "").trim();
  const postalCode = digitsPostalCode(data["post code"] || fallbackZip);
  if (!city || !state) return null;
  const latitude = parseGeoCoord(first.latitude);
  const longitude = parseGeoCoord(first.longitude);
  return {
    city,
    state,
    postalCode,
    ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
  };
}

export function parseCityLookup(payload: unknown, stateHint = ""): ShortPlace[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as ZippoPayload & { "state abbreviation"?: string };
  const state = normalizeStateCode(data["state abbreviation"] || stateHint);
  const seen = new Set<string>();
  const out: ShortPlace[] = [];
  for (const place of data.places || []) {
    const city = (place["place name"] || "").trim();
    const postalCode = digitsPostalCode(
      typeof (place as { "post code"?: string })["post code"] === "string"
        ? (place as { "post code": string })["post code"]
        : ""
    );
    if (!city || !postalCode) continue;
    const key = `${postalCode}:${city}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      city,
      state: normalizeStateCode(place["state abbreviation"] || state),
      postalCode,
    });
    if (out.length >= 6) break;
  }
  return out;
}

type ReverseGeocodePayload = {
  countryCode?: string;
  country_code?: string;
  principalSubdivision?: string;
  principalSubdivisionCode?: string;
  city?: string;
  locality?: string;
  localityName?: string;
  postcode?: string;
  postalCode?: string;
  postCode?: string;
};

/** Parse a reverse-geocode payload into city / state / ZIP. No street. */
export function parseReverseGeocode(payload: unknown): ShortPlace | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as ReverseGeocodePayload;
  const country = String(data.countryCode || data.country_code || "").toUpperCase();
  if (country && country !== "US" && country !== "USA") return null;
  const postalCode = digitsPostalCode(
    String(data.postcode || data.postalCode || data.postCode || "")
  );
  const subdivision = String(data.principalSubdivisionCode || "");
  const stateFromCode = subdivision.includes("-")
    ? normalizeStateCode(subdivision.split("-").pop() || "")
    : normalizeStateCode(subdivision);
  const state =
    stateFromCode || normalizeStateCode(String(data.principalSubdivision || ""));
  const city = String(data.city || data.locality || data.localityName || "").trim();
  if (!city && !postalCode) return null;
  return { city, state, postalCode };
}

const ZIPPO = "https://api.zippopotam.us/us";
const REVERSE_GEOCODE =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";

const zipLookupCache = new Map<string, ShortPlace | null>();

/** Resolve a US ZIP to city + state (+ centroid when the lookup includes it). */
export async function lookupUsZip(zip: string): Promise<ShortPlace | null> {
  const code = digitsPostalCode(zip);
  if (code.length !== 5) return null;
  if (zipLookupCache.has(code)) return zipLookupCache.get(code) || null;
  try {
    const res = await fetch(`${ZIPPO}/${code}`);
    if (!res.ok) {
      zipLookupCache.set(code, null);
      return null;
    }
    const parsed = parseZipLookup(await res.json(), code);
    zipLookupCache.set(code, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** GPS → city, state, ZIP. Never a street address. */
export async function reverseGeocodeUs(
  latitude: number,
  longitude: number
): Promise<ShortPlace | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  try {
    const res = await fetch(
      `${REVERSE_GEOCODE}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const parsed = parseReverseGeocode(await res.json());
    if (!parsed) return null;
    if (parsed.postalCode) {
      const fromZip = await lookupUsZip(parsed.postalCode);
      if (fromZip) return fromZip;
    }
    return parsed;
  } catch {
    return null;
  }
}

export type StreetAddressSuggestion = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  label: string;
};

export type ParsedMailingAddress = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Street line only: "123 Main St", never the city/state/ZIP suffix. */
export function streetLineOnly(
  street: string,
  place?: { city?: string | null; state?: string | null; postalCode?: string | null }
): string {
  const split = splitUsMailingAddress(street);
  if (split?.street) return split.street;
  let s = street.replace(/\s+/g, " ").trim();
  const zip = digitsPostalCode(place?.postalCode || "");
  if (zip) {
    s = s.replace(new RegExp(`[,\\s]+${zip}(?:-\\d{4})?$`), "");
  }
  const state = normalizeStateCode(place?.state);
  if (state) {
    s = s.replace(new RegExp(`[,\\s]+${state}$`, "i"), "");
  }
  const city = (place?.city || "").trim();
  if (city.length >= 2) {
    s = s.replace(new RegExp(`[,\\s]+${escapeRegExp(city)}$`, "i"), "");
  }
  s = s.replace(/[,\s]+$/, "").trim();
  return s || street.replace(/\s+/g, " ").trim();
}

/** Persist street / city / state / ZIP separately. Never the full mailing line. */
export function normalizeStoreLocation(input: {
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
}): ParsedMailingAddress {
  const split = splitUsMailingAddress(input.streetAddress);
  const city = (input.city.trim() || split?.city || "").trim();
  const state = normalizeStateCode(input.state || split?.state || "");
  const postalCode = digitsPostalCode(input.postalCode || split?.postalCode || "");
  return {
    street: streetLineOnly(input.streetAddress, { city, state, postalCode }),
    city,
    state,
    postalCode,
  };
}

/**
 * Split a pasted US mailing line into street / city / state / ZIP.
 * Returns null when it does not look like a full address.
 */
export function splitUsMailingAddress(raw: string): ParsedMailingAddress | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line.includes(",") && !/\d{5}(?:-\d{4})?/.test(line)) return null;

  const withComma = line.match(
    /^(.*?),\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+?)\s+(\d{5})(?:-\d{4})?$/
  );
  if (withComma) {
    const state = normalizeStateCode(withComma[3]);
    const street = withComma[1].trim();
    const city = withComma[2].trim();
    if (state && street.length >= 3 && city.length >= 2) {
      return { street, city, state, postalCode: withComma[4] };
    }
  }

  const cityStateZip = line.match(
    /^(.*?),\s*([^,]+?)\s+([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/
  );
  if (cityStateZip) {
    const state = normalizeStateCode(cityStateZip[3]);
    const street = cityStateZip[1].trim();
    const city = cityStateZip[2].trim();
    if (state && street.length >= 3 && city.length >= 2) {
      return { street, city, state, postalCode: cityStateZip[4] };
    }
  }

  return null;
}

function photonStreetLine(props: {
  housenumber?: string;
  street?: string;
  name?: string;
}): string {
  const number = (props.housenumber || "").trim();
  const street = (props.street || "").trim();
  if (number && street) return `${number} ${street}`;
  if (street) return street;
  const name = (props.name || "").trim();
  if (/^\d/.test(name)) return streetLineOnly(name);
  return "";
}

export function parsePhotonStreetFeatures(
  payload: unknown
): StreetAddressSuggestion[] {
  if (!payload || typeof payload !== "object") return [];
  const features = (payload as { features?: unknown[] }).features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const out: StreetAddressSuggestion[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const props = (feature as { properties?: Record<string, unknown> }).properties;
    if (!props) continue;
    const country = String(props.countrycode || props.country || "").toUpperCase();
    if (country && country !== "US" && country !== "USA" && country !== "UNITED STATES") {
      continue;
    }
    const street = photonStreetLine({
      housenumber: typeof props.housenumber === "string" ? props.housenumber : "",
      street: typeof props.street === "string" ? props.street : "",
      name: typeof props.name === "string" ? props.name : "",
    });
    const city = String(props.city || props.town || props.village || props.district || "").trim();
    const state = normalizeStateCode(String(props.state || props.county || ""));
    const postalCode = digitsPostalCode(String(props.postcode || ""));
    if (street.length < 3 || !city || !state || !postalCode) continue;
    const key = `${street.toLowerCase()}|${postalCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      street,
      city,
      state,
      postalCode,
      label: `${street} · ${formatShortPlace({ city, state, postalCode })}`,
    });
    if (out.length >= 6) break;
  }
  return out;
}

const PHOTON = "https://photon.komoot.io/api/";

/** Street suggestions. City / state / ZIP come back separately so we never save the full line. */
export async function lookupUsStreetAddress(
  query: string
): Promise<StreetAddressSuggestion[]> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 4) return [];
  try {
    const res = await fetch(
      `${PHOTON}?q=${encodeURIComponent(q)}&limit=8&lang=en`
    );
    if (!res.ok) return [];
    return parsePhotonStreetFeatures(await res.json());
  } catch {
    return [];
  }
}

/** Resolve a US city to matching ZIPs in that state. */
export async function lookupUsCity(
  state: string,
  city: string
): Promise<ShortPlace[]> {
  const st = normalizeStateCode(state).toLowerCase();
  const q = city.trim();
  if (!st || q.length < 3) return [];
  try {
    const res = await fetch(`${ZIPPO}/${st}/${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as ZippoPayload & {
      places?: Array<ZippoPlace & { "post code"?: string }>;
    };
    return parseCityLookup(data, st.toUpperCase());
  } catch {
    return [];
  }
}
