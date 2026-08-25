"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, MapPin, Menu, PackageSearch, Search, Sparkles, User, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  accountContactLabel,
  displayName,
  formatShortPlace,
  getConsumerEntitlements,
} from "@findit/domain";
import { BrandLogo } from "@/components/brand/logo";
import { usePublicHref } from "@/components/host/host-surface";
import { getCurrentProfile } from "@/lib/services/actions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

const ITEMS = [
  { href: "/home", label: "Find", icon: Search },
  { href: "/requests", label: "Requests", icon: PackageSearch },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/plan", label: "Plan", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function isActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (href === "/home") return path === "/home" || path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function CustomerMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const homeHref = usePublicHref("/home");
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const plus = entitlements.planId === "plus";
  const name = displayName(profile || {});
  const contact = accountContactLabel(profile || {});
  const place = formatShortPlace({
    city: profile?.default_city,
    state: profile?.default_state,
    postalCode: profile?.default_postal_code,
  });

  useEffect(() => {
    if (!open) return;
    getCurrentProfile().then(setProfile);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink transition-colors hover:bg-black/[0.05]",
            className
          )}
        >
          <Menu className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-[60] flex w-[min(20rem,88vw)] flex-col bg-white px-5 py-5 shadow-xl focus:outline-none duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:animate-in data-[state=open]:slide-in-from-left-full data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left-full"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="text-2xl font-bold tracking-tight text-ink">
              FINDIT
              {plus ? <span className="text-accent">+</span> : null}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-black/[0.05] hover:text-ink"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {plus ? "More Finds. Farther stores." : "Ask nearby stores who has it."}
          </p>

          <nav className="mt-8 flex flex-col gap-1" aria-label="Customer">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const href = item.href === "/home" ? homeHref : item.href;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    router.push(href);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                    active
                      ? "bg-accent-soft font-bold text-ink"
                      : "font-semibold text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-[3px] shrink-0 rounded-full",
                      active ? "bg-accent" : "bg-transparent"
                    )}
                    aria-hidden
                  />
                  <Icon
                    className={cn("h-4 w-4", active ? "text-accent" : "text-ink-muted")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="mt-auto rounded-2xl border border-hairline-strong bg-[var(--solid-chrome)] px-3 py-3"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-black text-sm font-semibold text-ink-inverse">
                {(name || "F").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold tracking-tight text-ink">
                  {name}
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-4 text-ink-muted">
                  {contact}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-ink-subtle">
                  <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                  <span className="truncate">{place || "Add city, state & ZIP"}</span>
                </span>
              </span>
            </span>
          </Link>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CustomerTopBar() {
  const homeHref = usePublicHref("/home");
  return (
    <>
      <header className="glass-chrome fixed inset-x-0 top-0 z-50 border-b border-hairline-strong pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-2 sm:px-4">
          <CustomerMenuButton />
          <Link
            href={homeHref}
            className="mx-auto inline-flex items-center"
            aria-label="FINDIT home"
          >
            <BrandLogo kind="mark" className="h-7 w-auto" />
          </Link>
          <div className="w-11 shrink-0" aria-hidden />
        </div>
      </header>
      <div
        className="h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0"
        aria-hidden
      />
    </>
  );
}
