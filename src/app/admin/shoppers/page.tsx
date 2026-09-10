import { redirect } from "next/navigation";
import { AdminPage, AdminPanel } from "@/components/admin/ui";
import { AdminPeopleTable } from "@/components/admin/people-table";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminPeopleAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminShoppersPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminPeopleAction("shopper");
  return (
    <AdminPage
      title="Shoppers"
      subtitle="Customer accounts. Suspend or restore only after confirming the popup."
    >
      <AdminPanel title={`Shoppers · ${rows.length}`}>
        <AdminPeopleTable rows={rows} />
      </AdminPanel>
    </AdminPage>
  );
}
