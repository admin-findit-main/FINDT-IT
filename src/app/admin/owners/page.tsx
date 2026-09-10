import { redirect } from "next/navigation";
import { AdminPage, AdminPanel } from "@/components/admin/ui";
import { AdminPeopleTable } from "@/components/admin/people-table";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminPeopleAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminOwnersPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminPeopleAction("owner");
  return (
    <AdminPage
      title="Owners"
      subtitle="People who own a store. Suspend only with confirmation."
    >
      <AdminPanel title={`Store owners · ${rows.length}`}>
        <AdminPeopleTable rows={rows} />
      </AdminPanel>
    </AdminPage>
  );
}
