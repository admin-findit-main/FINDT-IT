import {
  isCompleteShortPlace,
  mergeZipIntoGpsPlace,
  normalizeStateCode,
  parsePhotonReverse,
  parseReverseGeocode,
  lookupUsZip,
  type ShortPlace,
} from "@findit/domain";

const REVERSE_GEOCODE =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";
const PHOTON_REVERSE = "https://photon.komoot.io/reverse";
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

function cacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function usablePlace(place: ShortPlace | null): ShortPlace | null {
  if (!place) return null;
  const next = {
    city: place.city.trim(),
    state: normalizeStateCode(place.state),
    postalCode: place.postalCode,
  };
  if (isCompleteShortPlace(next)) return next;
  if (next.city.length >= 2 && next.state) return next;
  return null;
}

async function fetchPhotonReverse(
  latitude: number,
  longitude: number
): Promise<ShortPlace | null> {
  const url = new URL(PHOTON_REVERSE);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parsePhotonReverse(await response.json());
}

async function fetchBigDataCloudReverse(
  latitude: number,
  longitude: number
): Promise<ShortPlace | null> {
  const url = new URL(REVERSE_GEOCODE);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "en");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseReverseGeocode(await response.json());
}

export async function reverseGeocodeUsServer(
  latitude: number,
  longitude: number
): Promise<ShortPlace | null> {
  if (!isLikelyUsCoordinate(latitude, longitude)) return null;
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.place;

  try {
    let parsed =
      (await fetchPhotonReverse(latitude, longitude)) ||
      (await fetchBigDataCloudReverse(latitude, longitude));
    if (parsed?.postalCode) {
      parsed = mergeZipIntoGpsPlace(
        parsed,
        await lookupUsZip(parsed.postalCode)
      );
    }
    const place = usablePlace(parsed);
    cache.set(key, { place, expiresAt: Date.now() + CACHE_TTL_MS });
    return place;
  } catch {
    return null;
  }
}
