import { headers } from "next/headers";

export async function requestOrigin(): Promise<{
  ip: string;
  userAgent: string;
  path: string;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    "unknown";
  return {
    ip,
    userAgent: (h.get("user-agent") || "").slice(0, 180),
    path: h.get("x-invoke-path") || h.get("next-url") || "",
  };
}

export async function logDeniedAccess(scope: string, extra?: Record<string, unknown>) {
  const origin = await requestOrigin();
  console.warn("[FINDIT] denied", {
    scope,
    ip: origin.ip,
    userAgent: origin.userAgent,
    ...extra,
  });
}
