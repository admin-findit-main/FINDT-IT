import { redirect } from "next/navigation";

export default function AdminRequestsRedirect() {
  redirect("/admin/stores");
}
