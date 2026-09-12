"use client";

import Link from "next/link";
import {
  isAdminAppPath,
  isStoreAppPath,
  wrongLoginSideMessage,
  type LoginAudience,
} from "@findit/domain";
import { Button } from "@/components/ui/button";
import { GlassNotice } from "@/components/ui/glass";
import { isSafeNextPath } from "@/lib/auth/home-path";
import { useMarketingHomeHref, useSurfaceHref } from "@/components/host/host-surface";
import { cn } from "@/lib/utils";

export type AuthAudience = "shopper" | "store";
export type AuthIntent = "signin" | "create";
export type ContactMethod = "phone" | "email";

export function ContactMethodSwitch({
  value,
  onChange,
  emailFirst = false,
  ariaLabel = "Phone or email",
}: {
  value: ContactMethod;
  onChange: (next: ContactMethod) => void;
  emailFirst?: boolean;
  ariaLabel?: string;
}) {
  const tabs = emailFirst
    ? ([["email", "Email"], ["phone", "Phone"]] as const)
    : ([["phone", "Phone"], ["email", "Email"]] as const);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1"
    >
      {tabs.map(([id, label]) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              "min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors",
              selected
                ? "bg-white text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function shopperLoginPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    !isStoreAppPath(next) &&
    !next.startsWith("/invite") &&
    !isAdminAppPath(next)
  ) {
    return `/login?next=${encodeURIComponent(next)}`;
  }
  return "/login";
}

function shopperSignupPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    !isStoreAppPath(next) &&
    !next.startsWith("/invite") &&
    !isAdminAppPath(next)
  ) {
    return `/signup?next=${encodeURIComponent(next)}`;
  }
  return "/signup";
}

function storeLoginPath(next?: string | null) {
  if (
    isSafeNextPath(next) &&
    (isStoreAppPath(next) ||
      next.startsWith("/invite") ||
      isAdminAppPath(next))
  ) {
    return `/login/business?next=${encodeURIComponent(next)}`;
  }
  return "/login/business";
}

export function WrongLoginSideNotice({
  requiredAudience,
  next,
}: {
  requiredAudience: LoginAudience;
  next?: string | null;
}) {
  const shopperHref = useSurfaceHref("dashboard", shopperLoginPath(next));
  const storeHref = useSurfaceHref("store", storeLoginPath(next));
  const href = requiredAudience === "store" ? storeHref : shopperHref;
  const label =
    requiredAudience === "store" ? "Go to Store sign in" : "Go to Shopper sign in";

  return (
    <div className="space-y-3">
      <GlassNotice tone="muted">{wrongLoginSideMessage(requiredAudience)}</GlassNotice>
      <Button asChild className="w-full" size="lg">
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}

/** Who is signing in: shopper or store. */
export function AuthAudienceSwitch({
  audience,
  next,
  shopperHref,
  storeHref,
}: {
  audience: AuthAudience;
  next?: string | null;
  shopperHref?: string;
  storeHref?: string;
}) {
  const defaultShopperHref = useSurfaceHref("dashboard", shopperLoginPath(next));
  const defaultStoreHref = useSurfaceHref("store", storeLoginPath(next));
  const shopperDest = shopperHref ?? defaultShopperHref;
  const storeDest = storeHref ?? defaultStoreHref;

  return (
    <div
      role="tablist"
      aria-label="Account type"
      className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1"
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
              "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors",
              selected
                ? "bg-white text-ink shadow-sm"
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

/** Sign in vs create/apply — second row so navigation stays clear. */
export function AuthIntentSwitch({
  audience,
  intent,
  next,
}: {
  audience: AuthAudience;
  intent: AuthIntent;
  next?: string | null;
}) {
  const shopperLogin = useSurfaceHref("dashboard", shopperLoginPath(next));
  const shopperSignup = useSurfaceHref("dashboard", shopperSignupPath(next));
  const storeLogin = useSurfaceHref("store", storeLoginPath(next));
  const joinHref = useSurfaceHref("www", "/join");

  const tabs =
    audience === "store"
      ? ([
          ["signin", "Sign in", storeLogin],
          ["create", "Apply", joinHref],
        ] as const)
      : ([
          ["signin", "Sign in", shopperLogin],
          ["create", "Create account", shopperSignup],
        ] as const);

  return (
    <div
      role="tablist"
      aria-label={audience === "store" ? "Store action" : "Shopper action"}
      className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-hairline-strong bg-white p-1"
    >
      {tabs.map(([id, label, dest]) => {
        const selected = intent === id;
        return (
          <Link
            key={id}
            href={dest}
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors",
              selected
                ? "bg-[var(--fd-black)] text-ink-inverse"
                : "text-ink-muted hover:bg-black/[0.03] hover:text-ink"
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/** Minimal footer — no duplicate audience buttons. */
export function AuthPageLinks({
  audience,
}: {
  audience: AuthAudience;
  next?: string | null;
}) {
  const home = useMarketingHomeHref();

  return (
    <p className="mt-6 text-center text-sm text-ink-muted">
      <Link
        href={home}
        className="font-semibold text-ink underline-offset-2 hover:underline"
      >
        Back to askfindit.com
      </Link>
      {audience === "store" ? (
        <span className="mt-1 block text-xs">
          Owners and staff use the same store sign in.
        </span>
      ) : null}
    </p>
  );
}

export function AuthSignupLinks({ next }: { next?: string | null }) {
  return <AuthPageLinks audience="shopper" next={next} />;
}
