import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { notifyCustomerDevices } from "@/lib/services/expo-push";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_INTERNAL_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerId = String(body.customerId || "");
  const title = String(body.title || "");
  const text = String(body.body || "");
  if (!customerId || !title) {
    return NextResponse.json(
      { error: "customerId and title required" },
      { status: 400 }
    );
  }

  await notifyCustomerDevices({
    admin: createServiceClient(),
    customerId,
    title,
    body: text,
    data: body.data || {},
  });

  return NextResponse.json({ ok: true });
}
