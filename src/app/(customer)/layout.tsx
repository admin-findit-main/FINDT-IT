import { CustomerTopBar } from "@/components/customer/app-menu";
import { CustomerAlertListener } from "@/components/customer/alert-listener";
import { WebPushRegistrar } from "@/components/customer/web-push-registrar";
import { CustomerSessionProvider } from "@/components/customer/session";
import { ShopperOnboardingGate } from "@/components/customer/shopper-onboarding-gate";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getCurrentProfile } from "@/lib/services/actions";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask FINDIT",
};

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?next=/home");
  }
  if (isSoloAdmin(profile)) {
    redirect("/admin");
  }

  return (
    <CustomerSessionProvider profile={profile}>
      <ShopperOnboardingGate accountType={profile.account_type}>
        <div className="app-canvas min-h-dvh overflow-x-clip">
          <CustomerAlertListener userId={profile.id} />
          <WebPushRegistrar />
          <CustomerTopBar />
          <div className="mx-auto min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-full max-w-3xl pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </div>
      </ShopperOnboardingGate>
    </CustomerSessionProvider>
  );
}
