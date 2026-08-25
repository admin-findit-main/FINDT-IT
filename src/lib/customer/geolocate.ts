"use client";

import { reverseGeocodeUs, type ShortPlace } from "@findit/domain";

export type GeolocateOk = {
  ok: true;
  place: ShortPlace;
  coords: { lat: number; lng: number };
};

export type GeolocateFail = { ok: false; error: string };

export async function geolocateUsPlace(): Promise<GeolocateOk | GeolocateFail> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ok: false,
      error: "Location isn’t available on this device. Type your city instead.",
    };
  }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
      });
    });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const place = await reverseGeocodeUs(coords.lat, coords.lng);
    if (place && (place.postalCode || place.city)) {
      return { ok: true, place, coords };
    }
    return {
      ok: false,
      error: "Confirm your city so we can ask nearby stores.",
    };
  } catch {
    return {
      ok: false,
      error: "Couldn’t get location. Type your city instead.",
    };
  }
}
