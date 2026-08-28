"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isSafeNextPath } from "@/lib/auth/home-path";
import { useMarketingHomeHref, useSurfaceHref } from "@/components/host/host-surface";
import { cn } from "@/lib/utils";

export type AuthAudience = "shopper" | "store";

function shopperLoginPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    !next.startsWith("/store") &&
    !next.startsWith("/invite") &&
    !next.startsWith("/admin")
  ) {
    return `/login?next=${encodeURIComponent(next)}`;
  }
  return "/login";
}

function shopperSignupPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    !next.startsWith("/store") &&
    !next.startsWith("/invite") &&
    !next.startsWith("/admin")
  ) {
    return `/signup?next=${encodeURIComponent(next)}`;
  }
  return "/signup";
}

function storeLoginPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    (next.startsWith("/store") ||
      next.startsWith("/invite") ||
      next.startsWith("/admin"))
  ) {
    return `/login/business?next=${encodeURIComponent(next)}`;
  }
  return "/login/business";
}

export function AuthAudienceSwitch({
  audience,
  next,
  shopperHref,
  storeHref,
}: {
  audience: AuthAudience;
  next?: string | null;
  /** Override the Shopper tab — use `/signup` on create-account screens. */
  shopperHref?: string;
  /** Override the Store tab — use `/join` on apply/signup screens. */
  storeHref?: string;
}) {
  const defaultShopperHref = useSurfaceHref("dashboard", shopperLoginPath(next));
  const defaultStoreHref = useSurfaceHref("store", storeLoginPath(next));
  const shopperDest = shopperHref ?? defaultShopperHref;
  const storeDest = storeHref ?? defaultStoreHref;

  return (
    <div
      role="tablist"
      aria-label="Shopper or store"
      className="grid grid-cols-2 gap-1 rounded-glass-lg bg-[var(--solid-3)] p-1"
    >
      {(
        [
          ["shopper", "Shopper", shopperDest],
          ["store", "Store", storeDest],
        ] as const
      ).map(([id, label, dest]) => {
        const selected = audience === id;
        return (
          <Link
            key={id}
            href={dest}
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-glass-md px-3 text-sm font-semibold transition-colors",
              selected
                ? "bg-[var(--solid-1)] text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function AuthPageLinks({
  audience,
  next,
}: {
  audience: AuthAudience;
  next?: string | null;
}) {
  const home = useMarketingHomeHref();
  const shopperLogin = useSurfaceHref("dashboard", shopperLoginPath(next));
  const shopperSignup = useSurfaceHref("dashboard", shopperSignupPath(next));
  const storeLogin = useSurfaceHref("store", storeLoginPath(next));
  const joinHref = useSurfaceHref("www", "/join");

  if (audience === "store") {
    return (
      <div className="mt-6 space-y-3 border-t border-hairline-strong pt-5">
        <Button asChild variant="outline" className="w-full" size="lg">
          <Link href={shopperLogin}>Shopper sign in</Link>
        </Button>
        <p className="text-center text-sm text-ink-muted">
          New store?{" "}
          <Link
            href={joinHref}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Apply your business
          </Link>
        </p>
        <p className="text-center text-sm text-ink-muted">
          <Link
            href={home}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Go back to askfindit.com
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 border-t border-hairline-strong pt-5">
      <p className="text-center text-sm text-ink-muted">
        New shopper?{" "}
        <Link
          href={shopperSignup}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted">
        Store owner or staff?{" "}
        <Link
          href={storeLogin}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Sign in to your store
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted">
        <Link
          href={home}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Go back to askfindit.com
        </Link>
      </p>
    </div>
  );
}

export function AuthSignupLinks({ next }: { next?: string | null }) {
  const home = useMarketingHomeHref();
  const shopperLogin = useSurfaceHref("dashboard", shopperLoginPath(next));
  const storeLogin = useSurfaceHref("store", storeLoginPath(next));
  const joinHref = useSurfaceHref("www", "/join");

  return (
    <div className="mt-6 space-y-3 border-t border-hairline-strong pt-5">
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href={shopperLogin}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted">
        Store owner or staff?{" "}
        <Link
          href={storeLogin}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Sign in to your store
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted">
        Opening a store?{" "}
        <Link
          href={joinHref}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Apply your business
        </Link>
      </p>
      <p className="text-center text-sm text-ink-muted">
        <Link
          href={home}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Go back to askfindit.com
        </Link>
      </p>
    </div>
  );
}
