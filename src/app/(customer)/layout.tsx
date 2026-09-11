import { CustomerChrome } from "@/components/customer/customer-chrome";
import { CustomerSessionProvider } from "@/components/customer/session";
import { CustomerThemeRoot } from "@/components/customer/themes/theme-root";
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
      <CustomerThemeRoot themeId={profile.theme_id}>
        <CustomerChrome userId={profile.id} accountType={profile.account_type}>
          {children}
        </CustomerChrome>
      </CustomerThemeRoot>
    </CustomerSessionProvider>
  );
}
