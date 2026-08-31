import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { AdminPeopleTable } from "@/components/admin/people-table";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminPeopleAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminShoppersPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminPeopleAction("shopper");
  return (
    <Panel title={`Shoppers · ${rows.length}`}>
      <AdminPeopleTable rows={rows} />
    </Panel>
  );
}
