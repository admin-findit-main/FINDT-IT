import { NextResponse } from "next/server";
import { getStoreIncomingRequestsAction } from "@/lib/services/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || "";
  const filter = url.searchParams.get("filter") || "unanswered";
  const range = url.searchParams.get("range") || "7d";
  const rows = await getStoreIncomingRequestsAction(storeId, filter, range);
  return NextResponse.json(rows ?? [], {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
