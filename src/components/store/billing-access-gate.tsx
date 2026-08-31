"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export function StoreBillingAccessGate({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (allowed || pathname.startsWith("/store/subscription")) {
    return <>{children}</>;
  }
  return (
    <Card sheen className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Billing required</h1>
      <p className="mt-3 text-sm text-ink-muted">
        This location needs an active FINDIT Business subscription. A payment
        that is still processing does not lock you out.
      </p>
      <Button asChild className="mt-6">
        <Link href="/store/subscription">Go to billing</Link>
      </Button>
    </Card>
  );
}
