import { redirect } from "next/navigation";

/** Team was folded into Staff → Login access. */
export default function StoreTeamPage() {
  redirect("/store/shifts?tab=access");
}
