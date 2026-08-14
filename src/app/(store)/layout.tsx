import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreNav, StoreTopBar } from "@/components/shared/nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  canAccessStoreDashboardAction,
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/store");

  const access = await canAccessStoreDashboardAction();
  if (!access.allowed) {
    return (
      <div className="app-canvas min-h-screen">
        <header className="glass-chrome border-b border-hairline-strong px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-ink"
          >
            FINDIT
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          </Link>
        </header>
        <main className="mx-auto max-w-lg px-6 py-16">
          <Card sheen className="p-8 text-center">
            {access.reason === "pending_application" ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Application under review
                </h1>
                <p className="mt-3 leading-relaxed text-ink-muted">
                  We&apos;re reviewing{" "}
                  <span className="font-semibold">
                    {access.pendingApplication?.business_name}
                  </span>
                  . Approved stores get {STORE_TRIAL_DAYS} days free — you&apos;ll
                  get dashboard access after approval.
                </p>
                <Button asChild variant="ghost" className="mt-8">
                  <Link href="/home">Browse as a customer</Link>
                </Button>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Store access is by approval
                </h1>
                <p className="mt-3 leading-relaxed text-ink-muted">
                  Businesses apply to join FINDIT. After approval, owners get a{" "}
                  {STORE_TRIAL_DAYS}-day free trial. Staff join through an invite
                  from their store — not this page.
                </p>
                <Button asChild className="mt-8" size="lg">
                  <Link href="/join">Apply your business</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-4">
                  <Link href="/home">Browse as a customer</Link>
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
  const canManageStore = workspace?.canManageStore ?? false;
  const storeName = workspace?.store?.name || null;

  return (
    <div className="app-canvas min-h-screen md:flex">
      <StoreNav
        storeName={storeName}
        role={role}
        canManageStore={canManageStore}
      />
      <div className="mx-auto min-h-screen w-full max-w-3xl flex-1 pb-24 md:max-w-5xl md:pb-10 lg:max-w-6xl">
        <StoreTopBar
          storeName={storeName}
          role={role}
          canManageStore={canManageStore}
        />
        {children}
      </div>
    </div>
  );
}
