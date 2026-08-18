import { redirect } from "next/navigation";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getCurrentProfile, getStoreApplicationsAction } from "@/lib/services/actions";
import { AdminStoreApplications } from "../store-applications";

export default async function AdminApplicationsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/home");
  const applications = await getStoreApplicationsAction();
  return <AdminStoreApplications applications={applications} />;
}
