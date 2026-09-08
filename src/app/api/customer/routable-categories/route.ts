import { NextResponse } from "next/server";
import { getRoutableCategoryCounts } from "@/lib/services/routable-categories";

export const runtime = "nodejs";

export async function GET() {
  const categories = await getRoutableCategoryCounts();
  return NextResponse.json(
    { categories },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
