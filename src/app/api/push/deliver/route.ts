import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { boundUuid, sanitizeAppPath } from "@findit/domain";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  notifyCustomerDevices,
  notifyEmployeeDevices,
} from "@/lib/services/expo-push";

export const runtime = "nodejs";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return (
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_INTERNAL_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

function sanitizePushData(raw: Record<string, string> | undefined) {
  const data = raw || {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") continue;
    if (key === "url") {
      out.url = sanitizeAppPath(value, "/notifications");
      continue;
    }
    if (key === "type" || key === "storeName") {
      out[key] = value.slice(0, 120);
      continue;
    }
    if (
      key === "storeId" ||
      key === "notificationId" ||
      key === "requestId" ||
      key === "customerId"
    ) {
      const id = boundUuid(value);
      if (id) out[key] = id;
    }
  }
  if (!out.url) out.url = "/notifications";
  return out;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    console.warn("[FINDIT] denied push deliver", {
      ip: clientIp(request),
      userAgent: (request.headers.get("user-agent") || "").slice(0, 180),
      origin: request.headers.get("origin") || "",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    userIds?: string[];
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title || "").slice(0, 120);
  const text = String(body.body || "").slice(0, 500);
  const userIds = Array.isArray(body.userIds)
    ? body.userIds
        .map((id) => boundUuid(String(id)))
        .filter((id): id is string => Boolean(id))
    : [];
  const customerId = boundUuid(String(body.customerId || "")) || "";
  if (!title || (!customerId && !userIds.length)) {
    return NextResponse.json(
      { error: "title and customerId or userIds required" },
      { status: 400 }
    );
  }

  const data = sanitizePushData(body.data);
  const admin = createServiceClient();
  if (userIds.length) {
    await notifyEmployeeDevices({
      admin,
      userIds,
      title,
      body: text,
      data: { ...data, url: data.url || "/store" },
    });
  }
  if (customerId) {
    await notifyCustomerDevices({
      admin,
      customerId,
      title,
      body: text,
      data,
    });
  }

  return NextResponse.json({ ok: true });
}
