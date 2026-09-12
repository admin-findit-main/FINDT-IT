import { redirect } from "next/navigation";
import { getStoreWorkspaceAction } from "@/lib/services/actions";

/** Legacy route — store setup lives in Settings after approval. */
export default async function StoreOnboardingPage() {
  const workspace = await getStoreWorkspaceAction();
  if (workspace?.store?.id) {
    redirect("/store");
  }
  redirect("/join");
}
