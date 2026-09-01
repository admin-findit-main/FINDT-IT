"use client";

import { reverseGeocodeUs, type ShortPlace } from "@findit/domain";

export type GeolocateOk = {
  ok: true;
  place: ShortPlace;
  coords: { lat: number; lng: number };
};

export type GeolocateFail = { ok: false; error: string };

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 60_000,
};

const GEOCODE_BUDGET_MS = 8_000;

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

function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
  });
}

async function reverseGeocodeWithBudget(
  lat: number,
  lng: number
): Promise<ShortPlace | null> {
  try {
    return await Promise.race([
      reverseGeocodeUs(lat, lng),
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
    const pos = await readPosition();
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
