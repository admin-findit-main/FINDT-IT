"use client";

import { type ShortPlace } from "@findit/domain";

export type GeolocateOk = {
  ok: true;
  place: ShortPlace;
  coords: { lat: number; lng: number };
};

export type GeolocateFail = { ok: false; error: string };

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 5 * 60_000,
};

const GEOCODE_BUDGET_MS = 8_000;
const LAST_KNOWN_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 3_000,
  maximumAge: Infinity,
};

export function geolocationErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? Number((err as { code: number }).code)
      : NaN;
  if (code === 1) {
    return "Allow location for this site, then tap Locate me again. Or type your city.";
  }
  if (code === 3) {
    return "Location is taking too long. Try again near a window, or type your city.";
  }
  if (code === 2) {
    return "Couldn’t read GPS. Type your city — nearby ZIPs still reach stores in your radius.";
  }
  return "Couldn’t get location. Type your city instead.";
}

function readPosition(
  options: PositionOptions = POSITION_OPTIONS
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function reverseGeocodeWithBudget(
  lat: number,
  lng: number
): Promise<ShortPlace | null> {
  try {
    return await Promise.race([
      fetch("/api/location/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      }).then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { place?: ShortPlace };
        return body.place || null;
      }),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), GEOCODE_BUDGET_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

export async function geolocateUsPlace(): Promise<GeolocateOk | GeolocateFail> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ok: false,
      error: "Location isn’t available on this device. Type your city instead.",
    };
  }

  try {
    let pos: GeolocationPosition;
    try {
      pos = await readPosition();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? Number((error as { code: number }).code)
          : NaN;
      if (code === 1) throw error;
      pos = await readPosition(LAST_KNOWN_OPTIONS);
    }
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const place = await reverseGeocodeWithBudget(coords.lat, coords.lng);
    return {
      ok: true,
      place: place || { city: "", state: "", postalCode: "" },
      coords,
    };
  } catch (err) {
    return { ok: false, error: geolocationErrorMessage(err) };
  }
}
