import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { employeeDashItems, employeeMobileDashItems, ownerDashItems, ownerMobileDashItems } from "@/lib/dashboard/nav";
import { BrandHomeLink } from "@/components/brand/logo";
import { roleLabel } from "@/lib/auth/store-role";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { isSoloAdmin } from "@/lib/auth/admin";
import { marketingHomeHref } from "@/lib/config/product-hosts";
import {
  canAccessStoreDashboardAction,
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { getStoreBillingAccessAction } from "@/lib/billing/actions";
import { StoreBillingAccessGate } from "@/components/store/billing-access-gate";
import { StoreNotifyHost } from "@/components/store/notify-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FINDIT Business",
};

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login/business?next=/store");
  if (isSoloAdmin(profile)) redirect("/admin");

  const [access, workspace] = await Promise.all([
    canAccessStoreDashboardAction(),
    getStoreWorkspaceAction(),
  ]);
  if (!access.allowed) {
    return (
      <div className="app-canvas min-h-screen bg-canvas">
        <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-14 items-center">
            <BrandHomeLink href={marketingHomeHref()} kind="business" />
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-16">
          <Card sheen className="p-5 text-center sm:p-8">
            {access.reason === "pending_application" ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight">
                  {access.pendingApplication?.status === "needs_info"
                    ? "We need a bit more information"
                    : "Waiting for FINDIT to accept you"}
                </h1>
                <p className="mt-3 text-ink-muted">
                  We&apos;re reviewing{" "}
                  <span className="font-semibold">
                    {access.pendingApplication?.business_name}
                  </span>
                  . The dashboard, Hub, and devices stay locked until we accept
                  the application. Approved stores get {STORE_TRIAL_DAYS} days free
                  and a blue verified badge for shoppers.
                </p>
                {access.pendingApplication?.admin_notes ? (
                  <p className="mt-4 rounded-2xl border border-hairline-strong bg-white px-4 py-3 text-sm text-ink">
                    {access.pendingApplication.admin_notes}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Store access is by approval</h1>
                <p className="mt-3 text-ink-muted">
                  Businesses apply to join FINDIT. Staff join through an invite.
                </p>
                <Button asChild className="mt-8" size="lg">
                  <Link href="/join">Apply your business</Link>
                </Button>
              </>
            )}
          </Card>
        </main>
      </div>
    );
  }

  const role = workspace?.role || "employee";
  const canManage = workspace?.canManageStore ?? false;
  const storeName = workspace?.store?.name || "Store";
  const billingAccess = await getStoreBillingAccessAction(workspace?.store);

  return (
    <DashboardShell
      identity={storeName}
      role={roleLabel(role)}
      email={profile.email}
      items={canManage ? ownerDashItems : employeeDashItems}
      mobileItems={canManage ? ownerMobileDashItems : employeeMobileDashItems}
      accountHref="/store/account"
      logoutHref="/login/business"
    >
      <StoreNotifyHost userId={profile.id} />
      <StoreBillingAccessGate allowed={billingAccess.allowed}>
        {children}
      </StoreBillingAccessGate>
    </DashboardShell>
  );
}
