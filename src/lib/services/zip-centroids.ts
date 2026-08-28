import {
  digitsPostalCode,
  lookupUsZip,
  parseGeoCoord,
} from "@findit/domain";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

/** ZIP centroid from Zippopotam when the store or request has no GPS. */
export async function coordsFromZip(
  postalCode: string
): Promise<GeoPoint | null> {
  const place = await lookupUsZip(postalCode);
  const latitude = parseGeoCoord(place?.latitude);
  const longitude = parseGeoCoord(place?.longitude);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

export async function resolvePoint(input: {
  postalCode: string;
  latitude?: unknown;
  longitude?: unknown;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const latitude = parseGeoCoord(input.latitude);
  const longitude = parseGeoCoord(input.longitude);
  if (latitude != null && longitude != null) {
    return { latitude, longitude };
  }
  const fromZip = await coordsFromZip(input.postalCode);
  return {
    latitude: fromZip?.latitude ?? null,
    longitude: fromZip?.longitude ?? null,
  };
}

export async function resolvePointsByZip(
  postalCodes: string[]
): Promise<Map<string, GeoPoint>> {
  const unique = [
    ...new Set(postalCodes.map((z) => digitsPostalCode(z)).filter((z) => z.length === 5)),
  ];
  const out = new Map<string, GeoPoint>();
  await Promise.all(
    unique.map(async (zip) => {
      const point = await coordsFromZip(zip);
      if (point) out.set(zip, point);
    })
  );
  return out;
}
