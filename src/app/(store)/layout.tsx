import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { employeeDashItems, ownerDashItems } from "@/lib/dashboard/nav";
import { BrandHomeLink } from "@/components/brand/logo";
import { roleLabel } from "@/lib/auth/store-role";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { isSoloAdmin } from "@/lib/auth/admin";
import {
  canAccessStoreDashboardAction,
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login/business?next=/store");
  if (isSoloAdmin(profile)) redirect("/admin");

  const access = await canAccessStoreDashboardAction();
  if (!access.allowed) {
    return (
      <div className="app-canvas min-h-screen bg-canvas">
        <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong px-6 py-4">
          <BrandHomeLink href="/" kind="business" />
        </header>
        <main className="mx-auto max-w-lg px-6 py-16">
          <Card sheen className="p-8 text-center">
            {access.reason === "pending_application" ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Application under review</h1>
                <p className="mt-3 text-ink-muted">
                  We&apos;re reviewing{" "}
                  <span className="font-semibold">
                    {access.pendingApplication?.business_name}
                  </span>
                  . Approved stores get {STORE_TRIAL_DAYS} days free.
                </p>
                <Button asChild variant="ghost" className="mt-8">
                  <Link href="/home">Browse as a customer</Link>
                </Button>
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

  const workspace = await getStoreWorkspaceAction();
  const role = workspace?.role || "employee";
  const canManage = workspace?.canManageStore ?? false;
  const storeName = workspace?.store?.name || "Store";

  return (
    <DashboardShell
      identity={storeName}
      role={roleLabel(role)}
      email={profile.email}
      items={canManage ? ownerDashItems : employeeDashItems}
      accountHref="/store/account"
      logoutHref="/login/business"
    >
      {children}
    </DashboardShell>
  );
}
