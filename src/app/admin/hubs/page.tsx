import { PendingNote } from "@/components/dashboard/shell";

export default function AdminHubsPage() {
  return (
    <PendingNote>
      FINDIT Hub device registry is not in the database yet. When `hub_devices` ships, this
      directory will list device ID, store, last seen, and activation status. The live kiosk
      remains at /store/hub for each store.
    </PendingNote>
  );
}
