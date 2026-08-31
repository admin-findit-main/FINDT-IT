import { NextResponse } from "next/server";
import { verifyFastSpringSignature } from "@/lib/billing/fastspring";
import {
  processFastSpringWebhook,
  type FastSpringWebhookBody,
} from "@/lib/billing/webhooks";
import { fastSpringConfig } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function header(request: Request, name: string) {
  return (
    request.headers.get(name) ||
    request.headers.get(name.toLowerCase()) ||
    request.headers.get(name.toUpperCase())
  );
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = fastSpringConfig().webhookSecret;
  if (!secret) {
    console.warn("[FINDIT] FastSpring webhook rejected: secret is not configured");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const signature =
    header(request, "X-FS-Signature") || header(request, "x-fs-signature");
  if (!verifyFastSpringSignature(raw, signature, secret)) {
    console.warn("[FINDIT] FastSpring webhook signature failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: FastSpringWebhookBody;
  try {
    body = JSON.parse(raw) as FastSpringWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processFastSpringWebhook(body);
    console.info("[FINDIT] FastSpring webhook", {
      accepted: result.accepted,
      duplicates: result.duplicates,
      skipped: result.skipped,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[FINDIT] FastSpring webhook failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
