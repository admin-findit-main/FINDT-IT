"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ASSETS = {
  mark: {
    light: { src: "/brand/findit-mark-light.png", width: 527, height: 490 },
    dark: { src: "/brand/findit-mark-dark.png", width: 525, height: 491 },
  },
  plus: {
    light: { src: "/brand/findit-plus-light.png", width: 649, height: 152 },
    dark: { src: "/brand/findit-plus-dark.png", width: 649, height: 152 },
  },
  business: {
    light: { src: "/brand/findit-business-light.png", width: 920, height: 152 },
    dark: { src: "/brand/findit-business-dark.png", width: 920, height: 152 },
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
      className={cn("h-7 w-auto", className)}
      decoding="async"
    />
  );
}

/** F-mark + FINDIT word. Use on customer chrome. */
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
            "text-xl font-bold tracking-tight",
            tone === "dark" ? "text-ink-inverse" : "text-ink"
          )}
        >
          FINDIT
        </span>
      ) : null}
    </span>
  );
}

export function BrandHomeLink({
  href = "/",
  kind = "findit",
  tone = "light",
  className,
}: {
  href?: string;
  kind?: "findit" | "business" | "plus";
  tone?: BrandTone;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      {kind === "findit" ? (
        <BrandLockup tone={tone} />
      ) : kind === "plus" ? (
        <BrandLogo kind="plus" tone={tone} className="h-6 w-auto" />
      ) : (
        <BrandLogo kind="business" tone={tone} className="h-6 w-auto sm:h-7" />
      )}
    </Link>
  );
}

/** Customer FINDIT lockup, or FINDIT Business on `/login/business`. */
export function AuthBrandLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const business = pathname.startsWith("/login/business");
  return (
    <BrandHomeLink
      href={business ? "/login/business" : "/"}
      kind={business ? "business" : "findit"}
      className={className}
    />
  );
}
