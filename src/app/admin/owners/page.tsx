import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { AdminPeopleTable } from "@/components/admin/people-table";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminPeopleAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminOwnersPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminPeopleAction("owner");
  return (
    <Panel title={`Store owners · ${rows.length}`}>
      <AdminPeopleTable rows={rows} />
    </Panel>
  );
}
