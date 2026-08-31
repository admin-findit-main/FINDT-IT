"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { matchProductSurface, resolveBrandHomeHref } from "@/lib/config/product-hosts";
import { useHostSurface } from "@/components/host/host-surface";

const ASSETS = {
  mark: {
    light: { src: "/brand/findit-mark-light.png", width: 535, height: 498 },
    dark: { src: "/brand/findit-mark-dark.png", width: 533, height: 497 },
  },
  plus: {
    light: { src: "/brand/findit-plus-light.png", width: 639, height: 143 },
    dark: { src: "/brand/findit-plus-dark.png", width: 639, height: 143 },
  },
  business: {
    light: { src: "/brand/findit-business-light.png", width: 919, height: 143 },
    dark: { src: "/brand/findit-business-dark.png", width: 917, height: 142 },
  },
} as const;

export type BrandKind = keyof typeof ASSETS;
/** `light` = dark ink on a light surface. `dark` = white ink on a dark surface. */
export type BrandTone = "light" | "dark";

const ALT: Record<BrandKind, string> = {
  mark: "FINDIT",
  plus: "FINDIT+",
  business: "FINDIT Business",
};

const DEFAULT_HEIGHT: Record<BrandKind, string> = {
  mark: "h-8",
  plus: "h-7",
  business: "h-7",
};

export function BrandLogo({
  kind = "mark",
  tone = "light",
  className,
  alt,
}: {
  kind?: BrandKind;
  tone?: BrandTone;
  className?: string;
  alt?: string;
}) {
  const asset = ASSETS[kind][tone];
  return (
    // Brand files are static PNGs in /public/brand.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt={alt ?? ALT[kind]}
      width={asset.width}
      height={asset.height}
      className={cn(
        DEFAULT_HEIGHT[kind],
        "w-auto max-w-full object-contain object-left",
        className
      )}
      decoding="async"
      draggable={false}
    />
  );
}

/** F-mark + FINDIT word. Use on customer and marketing chrome. */
export function BrandLockup({
  tone = "light",
  className,
  wordmark = true,
}: {
  tone?: BrandTone;
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandLogo kind="mark" tone={tone} className="h-8 w-auto" alt="" />
      {wordmark ? (
        <span
          className={cn(
            "text-[1.45rem] font-bold leading-none tracking-tight",
            tone === "dark" ? "text-white" : "text-ink"
          )}
        >
          FINDIT
        </span>
      ) : null}
    </span>
  );
}

export function BrandHomeLink({
  href,
  kind = "findit",
  tone = "light",
  className,
}: {
  href?: string;
  kind?: "findit" | "business" | "plus";
  tone?: BrandTone;
  className?: string;
}) {
  const pathname = usePathname() || "/";
  const contextSurface = useHostSurface();
  const surface =
    typeof window !== "undefined"
      ? matchProductSurface(window.location.host)
      : contextSurface;
  const destination =
    href ??
    resolveBrandHomeHref({
      surface,
      pathname,
      hostHeader: typeof window !== "undefined" ? window.location.host : undefined,
    });
  return (
    <Link href={destination} className={cn("inline-flex items-center", className)}>
      {kind === "findit" ? (
        <BrandLockup tone={tone} />
      ) : kind === "plus" ? (
        <BrandLogo kind="plus" tone={tone} />
      ) : (
        <BrandLogo kind="business" tone={tone} />
      )}
    </Link>
  );
}

/** Customer FINDIT lockup, or FINDIT Business on `/login/business`. */
export function AuthBrandLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const contextSurface = useHostSurface();
  const surface =
    typeof window !== "undefined"
      ? matchProductSurface(window.location.host)
      : contextSurface;
  const business =
    pathname.startsWith("/login/business") ||
    (surface === "store" && pathname.startsWith("/login"));
  return (
    <BrandHomeLink
      kind={business ? "business" : "findit"}
      className={className}
    />
  );
}
