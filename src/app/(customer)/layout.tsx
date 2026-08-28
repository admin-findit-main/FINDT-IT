import { CustomerTopBar } from "@/components/customer/app-menu";
import { CustomerAlertListener } from "@/components/customer/alert-listener";
import { NotificationPrompt } from "@/components/customer/notification-prompt";
import { WebPushRegistrar } from "@/components/customer/web-push-registrar";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getCurrentProfile } from "@/lib/services/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
    <div className="app-canvas min-h-screen">
      <CustomerAlertListener userId={profile.id} />
      <WebPushRegistrar />
      <CustomerTopBar />
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-3xl">
        <NotificationPrompt />
        {children}
      </div>
    </div>
  );
}
