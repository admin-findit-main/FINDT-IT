import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  canAccessStoreDashboardAction,
  getCurrentProfile,
} from "@/lib/services/actions";
import { getStoreBillingAccessAction } from "@/lib/billing/actions";
import { getHubRuntimeAction } from "@/lib/services/hub-devices";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FINDIT Hub",
  applicationName: "FINDIT Hub",
  manifest: "/hub.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FINDIT Hub",
  },
};

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtime = await getHubRuntimeAction();
  if (runtime?.store) {
    const billing = await getStoreBillingAccessAction(runtime.store);
    if (!billing.allowed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black p-8 text-center text-white">
          <p>This Hub is paused until billing is current.</p>
        </div>
      );
    }
    return children;
  }

  const profile = await getCurrentProfile();
  if (!profile) return children;

  const access = await canAccessStoreDashboardAction();
  if (!access.allowed) redirect("/store");

  return children;
}
