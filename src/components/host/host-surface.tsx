"use client";

import { createContext, useContext } from "react";
import {
  marketingHomeHrefForSurface,
  matchProductSurface,
  surfaceHref,
  toInternalPath,
  toPublicPath,
  type ProductSurface,
} from "@/lib/config/product-hosts";

const HostSurfaceContext = createContext<ProductSurface>("local");

export function HostSurfaceProvider({
  surface,
  children,
}: {
  surface: ProductSurface;
  children: React.ReactNode;
}) {
  return (
    <HostSurfaceContext.Provider value={surface}>
      {children}
    </HostSurfaceContext.Provider>
  );
}

export function useHostSurface(): ProductSurface {
  return useContext(HostSurfaceContext);
}

export function usePublicHref(internalPath: string): string {
  const surface = useHostSurface();
  if (typeof window !== "undefined") {
    return toPublicPath(matchProductSurface(window.location.host), internalPath);
  }
  return toPublicPath(surface, internalPath);
}

export function useMarketingHomeHref(): string {
  return marketingHomeHrefForSurface(useHostSurface());
}

export function useSurfaceHref(
  target: Exclude<ProductSurface, "local">,
  pathname: string
): string {
  return surfaceHref(target, pathname, useHostSurface());
}

export function useInternalPathname(pathname: string): string {
  const surface = useHostSurface();
  const hostSurface =
    typeof window !== "undefined"
      ? matchProductSurface(window.location.host)
      : surface;
  return toInternalPath(hostSurface, pathname);
}
