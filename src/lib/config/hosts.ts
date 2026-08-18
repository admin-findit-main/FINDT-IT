/**
 * Optional host-based shells on the existing Vercel Next.js app.
 * Unset FINDIT_*_HOST env vars (the default) and this is a no-op.
 * Do not add DNS or extra Vercel projects until these hosts are set.
 */
export type HostSurface = "business" | "hub" | "admin";

export function hostnameOf(hostHeader: string): string {
  return hostHeader.split(":")[0].trim().toLowerCase();
}

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
