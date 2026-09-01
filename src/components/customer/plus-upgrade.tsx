import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { CUSTOMER_PLANS } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { GlassNotice } from "@/components/ui/glass";

const plus = CUSTOMER_PLANS.plus;
const free = CUSTOMER_PLANS.free;

export function PlusUpgradeCard({
  used,
  limit,
}: {
  used?: number;
  limit?: number;
}) {
  const cap = limit ?? free.monthlyRequests ?? 5;
  const count = used ?? cap;
  return (
    <GlassNotice tone="order" className="space-y-3">
      <BrandLogo kind="plus" className="h-6 w-auto" />
      <p className="text-lg font-semibold tracking-tight text-ink">
        You&apos;ve used your Finds this month.
      </p>
      <p className="text-sm text-ink-muted">
        {count} / {cap} used. Canceling a Find does not give it back. New Finds
        open next month.
      </p>
      <p className="text-xs text-ink-muted">
        {plus.name} includes more Finds and a wider search. See plans for
        details.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/plan">See plans</Link>
      </Button>
    </GlassNotice>
  );
}
