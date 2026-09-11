import { redirect } from "next/navigation";
import { AddLocationForm } from "@/components/store/add-location-form";
import {
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";

export default async function AddStoreLocationPage() {
  const [profile, workspace] = await Promise.all([
    getCurrentProfile(),
    getStoreWorkspaceAction(),
  ]);
  if (!profile) redirect("/login/business?next=/store/locations/add");
  if (!workspace?.canManageStore) redirect("/store");

  const ownerName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.display_name ||
    profile.email ||
    "Owner";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add a location</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Keep your same FINDIT Business login. Fill out the location form — FINDIT
          reviews it like a normal join application.
        </p>
      </div>
      <AddLocationForm ownerName={ownerName} ownerEmail={profile.email || ""} />
    </div>
  );
}
