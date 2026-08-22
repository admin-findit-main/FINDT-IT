import type { NextRequest } from "next/server";
import { canManageFromRole } from "@findit/domain";
import {
  CANONICAL_PRODUCT_HOSTS,
  isWwwPublicPath,
  matchProductSurface,
  productUrl,
  toInternalPath,
  toPublicPath,
  type ProductSurface,
} from "@/lib/config/product-hosts";

export type StoreActor =
  | "anonymous"
  | "customer"
  | "employee"
  | "manager"
  | "admin";

export type HostDecision =
  | { kind: "redirect"; url: URL; permanent?: boolean }
  | {
      kind: "continue";
      surface: ProductSurface;
      publicPath: string;
      internalPath: string;
      rewrite: boolean;
    };

function absolute(
  request: NextRequest,
  surface: Exclude<ProductSurface, "local">,
  pathname: string
): URL {
  const pretty = toPublicPath(surface, pathname);
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.port = "";
  url.hostname =
    surface === "www"
      ? CANONICAL_PRODUCT_HOSTS.www
      : surface === "dashboard"
        ? CANONICAL_PRODUCT_HOSTS.dashboard
        : surface === "store"
          ? CANONICAL_PRODUCT_HOSTS.store
          : CANONICAL_PRODUCT_HOSTS.app;
  url.pathname = pretty;
  return url;
}

export function decideHostRouting(
  request: NextRequest,
  actor: StoreActor
): HostDecision {
  const host = request.headers.get("host") || "";
  const surface = matchProductSurface(host);
  const publicPath = request.nextUrl.pathname || "/";

  if (surface === "apex") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.port = "";
    url.hostname = CANONICAL_PRODUCT_HOSTS.www;
    return { kind: "redirect", url, permanent: true };
  }

  if (surface === "local") {
    return {
      kind: "continue",
      surface,
      publicPath,
      internalPath: publicPath,
      rewrite: false,
    };
  }

  if (surface === "app") {
    if (publicPath === "/" || publicPath === "") {
      return { kind: "redirect", url: absolute(request, "www", "/"), permanent: true };
    }
    if (publicPath.startsWith("/auth")) {
      return {
        kind: "continue",
        surface,
        publicPath,
        internalPath: publicPath,
        rewrite: false,
      };
    }
    if (publicPath.startsWith("/admin") || publicPath.startsWith("/store")) {
      return { kind: "redirect", url: absolute(request, "store", publicPath) };
    }
    if (
      publicPath.startsWith("/home") ||
      publicPath.startsWith("/requests") ||
      publicPath.startsWith("/login") ||
      publicPath.startsWith("/signup")
    ) {
      return {
        kind: "redirect",
        url: absolute(request, "dashboard", publicPath),
      };
    }
    return { kind: "redirect", url: absolute(request, "www", "/") };
  }

  if (surface === "www") {
    if (publicPath === "/signup" || publicPath.startsWith("/signup/")) {
      return { kind: "redirect", url: absolute(request, "dashboard", publicPath) };
    }
    if (publicPath === "/login/business" || publicPath.startsWith("/login/business/")) {
      return { kind: "redirect", url: absolute(request, "store", "/login") };
    }
    if (publicPath === "/login" || publicPath.startsWith("/login/")) {
      return { kind: "redirect", url: absolute(request, "dashboard", publicPath) };
    }
    if (publicPath.startsWith("/home") || publicPath.startsWith("/plan") || publicPath.startsWith("/profile") || publicPath.startsWith("/welcome") || publicPath.startsWith("/notifications")) {
      return { kind: "redirect", url: absolute(request, "dashboard", publicPath) };
    }
    if (publicPath.startsWith("/store") || publicPath.startsWith("/admin") || publicPath.startsWith("/invite")) {
      return { kind: "redirect", url: absolute(request, "store", publicPath) };
    }
    if (publicPath.startsWith("/forgot-password")) {
      return { kind: "redirect", url: absolute(request, "dashboard", publicPath) };
    }
    return {
      kind: "continue",
      surface,
      publicPath,
      internalPath: publicPath,
      rewrite: false,
    };
  }

  if (surface === "dashboard") {
    if (publicPath.startsWith("/join")) {
      return { kind: "redirect", url: absolute(request, "www", publicPath) };
    }
    if (
      publicPath.startsWith("/store") ||
      publicPath.startsWith("/admin") ||
      publicPath === "/login/business" ||
      publicPath.startsWith("/invite")
    ) {
      return { kind: "redirect", url: absolute(request, "store", publicPath) };
    }
    if (actor === "admin") {
      return { kind: "redirect", url: absolute(request, "store", "/admin") };
    }
    if (actor === "manager" || actor === "employee") {
      return { kind: "redirect", url: absolute(request, "store", "/") };
    }
    if (publicPath === "/" && actor === "anonymous") {
      return {
        kind: "continue",
        surface,
        publicPath,
        internalPath: "/login",
        rewrite: true,
      };
    }
  }

  if (surface === "store") {
    if (publicPath.startsWith("/join") || isWwwPublicPath(publicPath) && publicPath !== "/") {
      if (publicPath !== "/") {
        return { kind: "redirect", url: absolute(request, "www", publicPath) };
      }
    }
    if (
      publicPath.startsWith("/home") ||
      publicPath.startsWith("/plan") ||
      publicPath.startsWith("/profile") ||
      publicPath.startsWith("/welcome") ||
      publicPath === "/signup" ||
      publicPath.startsWith("/signup/")
    ) {
      return { kind: "redirect", url: absolute(request, "dashboard", publicPath) };
    }
    if (actor === "admin" && publicPath === "/") {
      return {
        kind: "continue",
        surface,
        publicPath: "/",
        internalPath: "/admin",
        rewrite: true,
      };
    }
    if (actor === "employee" && publicPath === "/") {
      const hubUrl = request.nextUrl.clone();
      hubUrl.pathname = "/hub";
      hubUrl.search = "";
      return { kind: "redirect", url: hubUrl };
    }
    if (actor === "anonymous" && publicPath === "/") {
      return {
        kind: "continue",
        surface,
        publicPath,
        internalPath: "/login/business",
        rewrite: true,
      };
    }
  }

  let internalPath = toInternalPath(surface, publicPath);
  if (surface === "store" && actor === "employee" && internalPath === "/store") {
    internalPath = "/store/hub";
  }

  const pretty = toPublicPath(surface, internalPath);
  if (pretty !== publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = pretty;
    return { kind: "redirect", url };
  }

  return {
    kind: "continue",
    surface,
    publicPath,
    internalPath,
    rewrite: internalPath !== publicPath,
  };
}

export function classifyStoreActor(input: {
  isAdmin: boolean;
  accountType?: string | null;
  memberRole?: string | null;
  hasStoreMembership: boolean;
}): StoreActor {
  if (input.isAdmin) return "admin";
  if (input.memberRole && canManageFromRole(input.memberRole)) return "manager";
  if (input.hasStoreMembership || input.accountType === "business") {
    return input.memberRole === "employee" ? "employee" : "manager";
  }
  if (input.accountType === "customer") return "customer";
  return "customer";
}

export { productUrl };
