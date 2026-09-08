import { NextResponse } from "next/server";
import {
  isLikelyUsCoordinate,
  reverseGeocodeUsServer,
} from "@/lib/services/reverse-geocode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let latitude = NaN;
  let longitude = NaN;
  try {
    const body = (await request.json()) as {
      latitude?: unknown;
      longitude?: unknown;
    };
    latitude = Number(body.latitude);
    longitude = Number(body.longitude);
  } catch {
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });
  }
  if (!isLikelyUsCoordinate(latitude, longitude)) {
    return NextResponse.json(
      { error: "Location must be within the United States." },
      { status: 400 }
    );
  }
  const place = await reverseGeocodeUsServer(latitude, longitude);
  if (!place) {
    return NextResponse.json(
      { error: "We couldn't match that location to a US city." },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { place },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
