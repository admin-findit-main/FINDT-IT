import { NextResponse } from "next/server";
import { getPublicStoresForMap } from "@/lib/services/stores-map";

export const runtime = "nodejs";

function parseCoord(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoord(searchParams.get("lat"));
  const lng = parseCoord(searchParams.get("lng"));

  const stores = await getPublicStoresForMap({ lat, lng });
  return NextResponse.json(
    { stores },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
