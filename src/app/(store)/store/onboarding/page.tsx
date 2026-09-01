import Link from "next/link";
import { redirect } from "next/navigation";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  canAccessStoreDashboardAction,
  getCurrentProfile,
  getMyStoreApplicationStatusAction,
} from "@/lib/services/actions";

/**
 * Legacy route: send members to /store, applicants to status, others to /join.
 */
export default async function StoreOnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");

  const access = await canAccessStoreDashboardAction();
  if (access.allowed) redirect("/store");

  const pending = await getMyStoreApplicationStatusAction();
  if (pending) redirect("/store");

  return (
    <div className="mx-auto max-w-lg px-5 pt-10 md:px-8">
      <Card sheen className="p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Apply your business
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Store dashboards are for approved businesses. Apply for a{" "}
          {STORE_TRIAL_DAYS}-day free trial. We review before granting access.
          Staff join later through an invite from the owner.
        </p>
        <Button asChild className="mt-8" size="lg">
          <Link href="/join">Go to application</Link>
        </Button>
      </Card>
    </div>
  );
}
