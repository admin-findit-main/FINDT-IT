"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSurfaceHref } from "@/components/host/host-surface";

export function MarketingStartCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const shopperSignup = useSurfaceHref("dashboard", "/signup");
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");
  const joinHref = useSurfaceHref("www", "/join");

  return (
    <div className={compact ? "mt-0" : "mt-8"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg">
          <Link href={shopperSignup}>{compact ? "Start using FINDIT" : "Find something"}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={joinHref}>For stores</Link>
        </Button>
      </div>
      {compact ? null : (
        <p className="mt-5 text-sm text-ink-muted">
          Already on FINDIT?{" "}
          <Link
            href={shopperLogin}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
          {" · "}
          <Link
            href={storeLogin}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Store sign in
          </Link>
        </p>
      )}
    </div>
  );
}
