import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";
import { isSoloAdmin } from "@/lib/auth/admin";
import { adminDashItems } from "@/lib/dashboard/nav";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) redirect("/login/business");

  return (
    <DashboardShell
      tone="admin"
      identity="FINDIT Admin"
      role="Platform operator"
      email={profile.email}
      items={adminDashItems}
      accountHref="/admin"
      logoutHref="/login/business"
    >
      {children}
    </DashboardShell>
  );
}
