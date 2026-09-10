import { redirect } from "next/navigation";
import { AdminHubsPanel } from "@/components/admin/hubs-panel";
import { AdminPage } from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminHubsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminHubsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const hubs = await getAdminHubsAction();
  if (!hubs) redirect("/login/business");

  return (
    <AdminPage
      title="Hubs"
      subtitle="Paired counter tablets. Revoke with confirmation if a device is lost or rotated."
    >
      <AdminHubsPanel hubs={hubs} />
    </AdminPage>
  );
}
