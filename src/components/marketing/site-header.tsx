"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BrandHomeLink } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useSurfaceHref } from "@/components/host/host-surface";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#shoppers", label: "Shoppers" },
  { href: "/#stores", label: "Stores" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const menuId = useId();
  const signInRef = useRef<HTMLDivElement>(null);
  const shopperStart = useSurfaceHref("dashboard", "/start");
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");
  const joinHref = useSurfaceHref("www", "/join");

  function closeAll() {
    setOpen(false);
    setSignInOpen(false);
  }

  useEffect(() => {
    if (!signInOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSignInOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!signInRef.current?.contains(e.target as Node)) {
        setSignInOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [signInOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline-strong bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <BrandHomeLink href="/" className="shrink-0" />

        <nav
          className="ml-1 hidden items-center gap-0.5 md:flex"
          aria-label="FINDIT"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="relative hidden md:block" ref={signInRef}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={signInOpen}
              aria-haspopup="menu"
              onClick={() => setSignInOpen((v) => !v)}
            >
              Sign in
            </Button>
            {signInOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-hairline-strong bg-white py-1 shadow-[0_12px_32px_rgba(11,11,12,0.12)]"
              >
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Choose account
                </p>
                <Link
                  role="menuitem"
                  href={shopperLogin}
                  className="block px-3 py-2.5 text-sm font-medium text-ink hover:bg-black/[0.04]"
                  onClick={closeAll}
                >
                  Shopper
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                    Find and claim offers
                  </span>
                </Link>
                <Link
                  role="menuitem"
                  href={storeLogin}
                  className="block px-3 py-2.5 text-sm font-medium text-ink hover:bg-black/[0.04]"
                  onClick={closeAll}
                >
                  Store
                  <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                    Owners and staff
                  </span>
                </Link>
              </div>
            ) : null}
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
          >
            <Link href={joinHref}>Apply store</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={shopperStart}>Get started</Link>
          </Button>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => {
              setSignInOpen(false);
              setOpen((value) => !value);
            }}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span className="flex flex-col gap-1.5" aria-hidden>
              <span
                className={cn(
                  "block h-px w-4 bg-ink transition-transform",
                  open && "translate-y-[3.5px] rotate-45"
                )}
              />
              <span
                className={cn(
                  "block h-px w-4 bg-ink transition-transform",
                  open && "-translate-y-[3.5px] -rotate-45"
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id={menuId}
          className="border-t border-hairline-strong px-4 py-3 md:hidden"
          aria-label="FINDIT"
        >
          <ul className="space-y-0.5">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink"
                  onClick={closeAll}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-hairline-strong pt-2">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                Sign in
              </p>
              <Link
                href={shopperLogin}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink"
                onClick={closeAll}
              >
                Shopper
              </Link>
              <Link
                href={storeLogin}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink"
                onClick={closeAll}
              >
                Store
              </Link>
            </li>
            <li className="border-t border-hairline-strong pt-2">
              <Link
                href={joinHref}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink"
                onClick={closeAll}
              >
                Apply your store
              </Link>
              <Link
                href={shopperStart}
                className="mt-1 block rounded-lg bg-[var(--fd-black)] px-3 py-2.5 text-center text-sm font-semibold text-ink-inverse"
                onClick={closeAll}
              >
                Get started
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
