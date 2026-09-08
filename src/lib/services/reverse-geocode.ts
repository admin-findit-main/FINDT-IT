import {
  isCompleteShortPlace,
  normalizeStateCode,
  parseReverseGeocode,
  type ShortPlace,
} from "@findit/domain";

const REVERSE_GEOCODE =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";
const CACHE_TTL_MS = 15 * 60_000;
const cache = new Map<
  string,
  { expiresAt: number; place: ShortPlace | null }
>();

export function isLikelyUsCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 18 &&
    latitude <= 72 &&
    longitude >= -180 &&
    longitude <= -66
  );
}

export async function reverseGeocodeUsServer(
  latitude: number,
  longitude: number
): Promise<ShortPlace | null> {
  if (!isLikelyUsCoordinate(latitude, longitude)) return null;
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.place;

  try {
    const url = new URL(REVERSE_GEOCODE);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7_000),
      headers: { Accept: "application/json" },
    });
    const parsed = response.ok
      ? parseReverseGeocode(await response.json())
      : null;
    const place =
      parsed && isCompleteShortPlace({
        ...parsed,
        state: normalizeStateCode(parsed.state),
      })
        ? { ...parsed, state: normalizeStateCode(parsed.state) }
        : null;
    cache.set(key, { place, expiresAt: Date.now() + CACHE_TTL_MS });
    return place;
  } catch {
    return null;
  }
}
