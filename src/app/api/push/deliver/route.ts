import { NextResponse } from "next/server";
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
  return token.length > 0 && token === secret;
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

  const title = String(body.title || "");
  const text = String(body.body || "");
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.map((id) => String(id)).filter(Boolean)
    : [];
  const customerId = String(body.customerId || "");
  if (!title || (!customerId && !userIds.length)) {
    return NextResponse.json(
      { error: "title and customerId or userIds required" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  if (userIds.length) {
    await notifyEmployeeDevices({
      admin,
      userIds,
      title,
      body: text,
      data: body.data || { url: "/store" },
    });
  }
  if (customerId) {
    await notifyCustomerDevices({
      admin,
      customerId,
      title,
      body: text,
      data: body.data || {},
    });
  }

  return NextResponse.json({ ok: true });
}
