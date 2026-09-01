"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useSurfaceHref } from "@/components/host/host-surface";

export default function ForgotPasswordPage() {
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");

  return (
    <Card level="strong" sheen className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Sign in with a code
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        FINDIT does not use passwords. Request a 6-digit email code on the sign
        in screen. After that, this device stays signed in.
      </p>
      <div className="mt-6 space-y-3">
        <Button asChild className="w-full" size="lg">
          <Link href={shopperLogin}>Shopper sign in</Link>
        </Button>
        <Button asChild className="w-full" variant="outline" size="lg">
          <Link href={storeLogin}>Store sign in</Link>
        </Button>
      </div>
    </Card>
  );
}
