"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSurfaceHref } from "@/components/host/host-surface";

export function MarketingStartCard() {
  const shopperSignup = useSurfaceHref("dashboard", "/signup");
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");
  const joinHref = useSurfaceHref("www", "/join");

  return (
    <div
      id="start"
      className="rounded-2xl border border-hairline-strong bg-white p-6 sm:p-8"
    >
      <p className="text-lg font-semibold text-ink">Get started</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Shoppers send a Find with their phone. Stores apply, then answer from
        the counter.
      </p>
      <div className="mt-6 space-y-3">
        <Button asChild className="w-full" size="lg">
          <Link href={shopperSignup}>Create a shopper account</Link>
        </Button>
        <Button asChild variant="outline" className="w-full" size="lg">
          <Link href={joinHref}>Apply your store</Link>
        </Button>
      </div>
      <p className="mt-5 text-center text-sm text-ink-muted">
        Already on FINDIT?{" "}
        <Link
          href={shopperLogin}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Shopper sign in
        </Link>
        {" · "}
        <Link
          href={storeLogin}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Store sign in
        </Link>
      </p>
    </div>
  );
}
