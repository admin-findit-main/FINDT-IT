import { NextResponse } from "next/server";
import {
  authorizeHubInboxStoreAction,
  getStoreIncomingRequestsAction,
  getStoreWaitingRequestCountAction,
} from "@/lib/services/actions";
import { boundUuid } from "@findit/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || "";
  if (!boundUuid(storeId)) {
    return NextResponse.json({ error: "Invalid store" }, { status: 400 });
  }
  const authorization = await authorizeHubInboxStoreAction(storeId);
  if (authorization !== "authorized") {
    return NextResponse.json(
      { error: authorization === "unauthorized" ? "Unauthorized" : "Forbidden" },
      { status: authorization === "unauthorized" ? 401 : 403 }
    );
  }
  const mode = url.searchParams.get("mode");
  if (mode === "count") {
    const count = await getStoreWaitingRequestCountAction(storeId);
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
  const filter = url.searchParams.get("filter") || "unanswered";
  const range = url.searchParams.get("range") || "7d";
  const rows = await getStoreIncomingRequestsAction(storeId, filter, range);
  return NextResponse.json(rows ?? [], {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
