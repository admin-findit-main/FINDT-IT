/**
 * Legacy optional-host helpers. Production routing lives in product-hosts.ts.
 */
export type HostSurface = "business" | "hub" | "admin";

export { hostnameOf } from "@/lib/config/product-hosts";
import { hostnameOf } from "@/lib/config/product-hosts";

export function matchHostSurface(
  hostHeader: string,
  hosts: {
    business?: string | null;
    hub?: string | null;
    admin?: string | null;
  }
): HostSurface | null {
  const host = hostnameOf(hostHeader);
  if (!host) return null;
  const business = hosts.business?.trim().toLowerCase();
  const hub = hosts.hub?.trim().toLowerCase();
  const admin = hosts.admin?.trim().toLowerCase();
  if (business && host === business) return "business";
  if (hub && host === hub) return "hub";
  if (admin && host === admin) return "admin";
  return null;
}

/** Path to send `/` and `/login` to when a dedicated host is configured. */
export function resolveHostPathRedirect(
  surface: HostSurface | null,
  pathname: string
): string | null {
  if (!surface) return null;
  if (pathname === "/" || pathname === "") {
    if (surface === "business") return "/store";
    if (surface === "hub") return "/store/hub";
    return "/admin";
  }
  if (pathname === "/login") return "/login/business";
  return null;
}
