import { CustomerTopBar } from "@/components/customer/app-menu";
import { CustomerAlertListener } from "@/components/customer/alert-listener";
import { WebPushRegistrar } from "@/components/customer/web-push-registrar";
import { CustomerSessionProvider } from "@/components/customer/session";
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
      <div className="app-canvas min-h-screen overflow-x-clip">
        <CustomerAlertListener userId={profile.id} />
        <WebPushRegistrar />
        <CustomerTopBar />
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-3xl">
          {children}
        </div>
      </div>
    </CustomerSessionProvider>
  );
}
