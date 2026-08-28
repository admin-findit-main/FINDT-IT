/**
 * Production hostnames for the single Vercel Next.js app.
 * Localhost and Vercel preview URLs stay on the existing path-based UX.
 */

export type ProductSurface = "www" | "dashboard" | "store" | "app" | "local";

export const CANONICAL_PRODUCT_HOSTS = {
  www: "www.askfindit.com",
  dashboard: "dashboard.askfindit.com",
  store: "store.askfindit.com",
  app: "app.askfindit.com",
  apex: "askfindit.com",
} as const;

export function hostnameOf(hostHeader: string): string {
  return hostHeader.split(":")[0].trim().toLowerCase();
}

export function configuredProductHosts() {
  return {
    www: process.env.FINDIT_WWW_HOST?.trim() || CANONICAL_PRODUCT_HOSTS.www,
    dashboard:
      process.env.FINDIT_DASHBOARD_HOST?.trim() ||
      CANONICAL_PRODUCT_HOSTS.dashboard,
    store:
      process.env.FINDIT_STORE_HOST?.trim() ||
      process.env.FINDIT_BUSINESS_HOST?.trim() ||
      CANONICAL_PRODUCT_HOSTS.store,
    app: process.env.FINDIT_APP_HOST?.trim() || CANONICAL_PRODUCT_HOSTS.app,
    apex: CANONICAL_PRODUCT_HOSTS.apex,
  };
}

export function isLocalHostname(hostHeader: string): boolean {
  const host = hostnameOf(hostHeader);
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".vercel.app")
  );
}

export function isAskFinditFamily(hostHeader: string): boolean {
  const host = hostnameOf(hostHeader);
  return host === CANONICAL_PRODUCT_HOSTS.apex || host.endsWith(".askfindit.com");
}

export function matchProductSurface(hostHeader: string): ProductSurface | "apex" {
  const host = hostnameOf(hostHeader);
  if (isLocalHostname(host)) return "local";
  const hosts = configuredProductHosts();
  if (host === hosts.apex) return "apex";
  if (host === hosts.www) return "www";
  if (host === hosts.dashboard) return "dashboard";
  if (host === hosts.store) return "store";
  if (host === hosts.app) return "app";
  if (isAskFinditFamily(host)) return "www";
  return "local";
}

export function productOrigin(
  surface: Exclude<ProductSurface, "local">,
  protocol: "http" | "https" = "https"
): string {
  const hosts = configuredProductHosts();
  return `${protocol}://${hosts[surface]}`;
}

/** Host-only cookies on localhost; parent-domain cookies on askfindit.com. */
export function supabaseCookieDomain(hostHeader: string): string | undefined {
  if (!isAskFinditFamily(hostHeader)) return undefined;
  return ".askfindit.com";
}

export function supabaseCookieOptions(hostHeader: string): {
  path: string;
  sameSite: "lax";
  domain?: string;
  secure?: boolean;
} {
  const domain = supabaseCookieDomain(hostHeader);
  return {
    path: "/",
    sameSite: "lax",
    ...(domain ? { domain, secure: true } : {}),
  };
}

const PASS_THROUGH_PREFIXES = [
  "/api",
  "/auth",
  "/invite",
  "/admin",
  "/login",
  "/signup",
  "/forgot-password",
  "/join",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/business-terms",
  "/contact",
  "/pricing",
  "/stores",
];

function isPassThroughPath(pathname: string): boolean {
  return PASS_THROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function toInternalPath(
  surface: ProductSurface | "apex",
  pathname: string
): string {
  const path = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (surface === "dashboard") {
    if (path === "/") return "/home";
    return path;
  }
  if (surface === "store") {
    if (path === "/") return "/store";
    if (path === "/login") return "/login/business";
    if (path === "/hub" || path.startsWith("/hub/")) return `/store${path}`;
    if (path.startsWith("/store")) return path;
    if (isPassThroughPath(path)) return path;
    return `/store${path}`;
  }
  return path;
}

export function toPublicPath(
  surface: ProductSurface | "apex",
  pathname: string
): string {
  const path = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (surface === "dashboard") {
    if (path === "/home" || path.startsWith("/home/")) {
      return path.slice("/home".length) || "/";
    }
    return path;
  }
  if (surface === "store") {
    if (path === "/login/business") return "/login";
    if (path === "/store") return "/";
    if (path.startsWith("/store/")) return path.slice("/store".length);
    return path;
  }
  return path;
}

export function surfaceForAppPath(pathname: string): Exclude<ProductSurface, "local"> {
  const path = pathname.split("?")[0] || "/";
  if (
    path.startsWith("/store") ||
    path.startsWith("/admin") ||
    path.startsWith("/login/business") ||
    path.startsWith("/invite")
  ) {
    return "store";
  }
  if (
    path.startsWith("/home") ||
    path.startsWith("/requests") ||
    path.startsWith("/notifications") ||
    path.startsWith("/profile") ||
    path.startsWith("/plan") ||
    path.startsWith("/welcome") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/auth")
  ) {
    return "dashboard";
  }
  return "www";
}

export function productUrl(
  surface: Exclude<ProductSurface, "local">,
  pathname: string,
  currentHostHeader?: string
): string {
  const pretty = toPublicPath(surface, pathname);
  const host = currentHostHeader ? hostnameOf(currentHostHeader) : "";
  if (currentHostHeader && isLocalHostname(host)) return pretty;
  return `${productOrigin(surface)}${pretty}`;
}

/** Marketing homepage. Relative on localhost so local testing stays in-app. */
export function marketingHomeHref(hostHeader?: string): string {
  const host = hostHeader || (typeof window !== "undefined" ? window.location.host : "");
  if (!host || isLocalHostname(host)) return "/";
  return "https://www.askfindit.com";
}

/** Absolute post-login location. Relative on localhost. */
export function postAuthLocation(
  internalPath: string,
  currentHostHeader?: string
): string {
  const surface = surfaceForAppPath(internalPath);
  const host = currentHostHeader ? hostnameOf(currentHostHeader) : "";
  if (!currentHostHeader || isLocalHostname(host)) return internalPath;
  return productUrl(surface, internalPath, currentHostHeader);
}

export function isWwwPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path === "/" ||
    path === "/join" ||
    path.startsWith("/join/") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/acceptable-use") ||
    path.startsWith("/business-terms") ||
    path.startsWith("/contact") ||
    path.startsWith("/pricing") ||
    path.startsWith("/stores")
  );
}

/**
 * Where the FINDIT mark should send this visitor — marketing, shopper home,
 * store overview, or admin — based on host + path.
 */
export function resolveBrandHomeHref(input: {
  surface: ProductSurface | "apex";
  pathname: string;
  hostHeader?: string;
}): string {
  const path = input.pathname.split("?")[0] || "/";
  const surface = input.surface === "apex" ? "www" : input.surface;
  const host = input.hostHeader;

  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/auth") ||
    path.startsWith("/invite") ||
    path === "/join" ||
    path.startsWith("/join/") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/acceptable-use") ||
    path.startsWith("/business-terms") ||
    path.startsWith("/contact") ||
    path.startsWith("/pricing") ||
    path.startsWith("/stores")
  ) {
    return marketingHomeHref(host);
  }

  const app = surface === "local" ? surfaceForAppPath(path) : surface;

  if (app === "dashboard") {
    return surface === "local" ? "/home" : toPublicPath("dashboard", "/home");
  }
  if (app === "store") {
    const dest = path.startsWith("/admin") ? "/admin" : "/store";
    return surface === "local" ? dest : toPublicPath("store", dest);
  }

  return marketingHomeHref(host);
}

