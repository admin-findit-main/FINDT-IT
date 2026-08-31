"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandHomeLink } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useSurfaceHref } from "@/components/host/host-surface";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#stores", label: "For stores" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const shopperSignup = useSurfaceHref("dashboard", "/signup");
  const shopperLogin = useSurfaceHref("dashboard", "/login");

  return (
    <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 sm:px-6">
        <BrandHomeLink href="/" className="shrink-0" />
        <nav
          className="ml-2 hidden items-center gap-6 md:flex"
          aria-label="FINDIT"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={shopperLogin}>Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={shopperSignup}>Get started</Link>
          </Button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-glass-md text-ink md:hidden"
            aria-expanded={open}
            aria-controls="marketing-menu"
            onClick={() => setOpen((value) => !value)}
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
          id="marketing-menu"
          className="border-t border-hairline-strong px-5 py-3 md:hidden"
          aria-label="FINDIT"
        >
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-glass-md px-2 py-2.5 text-sm font-medium text-ink"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={shopperLogin}
                className="block rounded-glass-md px-2 py-2.5 text-sm font-medium text-ink"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href={shopperSignup}
                className="block rounded-glass-md px-2 py-2.5 text-sm font-medium text-ink"
                onClick={() => setOpen(false)}
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
