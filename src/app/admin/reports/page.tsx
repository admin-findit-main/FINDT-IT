import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { AdminReportsPanel } from "@/components/admin/reports-queue";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminReportsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminReportsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const reports = await getAdminReportsAction();

  return (
    <AdminPage
      title="Reports"
      subtitle="Confirm every moderation decision. Resolve when handled; dismiss when no action is needed."
    >
      <AdminReportsPanel reports={reports} />
    </AdminPage>
  );
}
