"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { AdminEmpty, AdminPanel } from "@/components/admin/ui";
import { adminRevokeHubDeviceAction } from "@/lib/admin/ops-actions";
import { formatRelativeTime } from "@/lib/utils";

export type AdminHubListRow = {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  pairedAt: string;
};

export function AdminHubsPanel({ hubs }: { hubs: AdminHubListRow[] }) {
  const router = useRouter();

  if (hubs.length === 0) {
    return <AdminEmpty title="No Hub tablets paired yet" />;
  }

  return (
    <AdminPanel title={`FINDIT Hubs · ${hubs.length}`}>
      <ul className="divide-y divide-black/[0.06] text-sm">
        {hubs.map((hub) => (
          <li
            key={hub.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{hub.name}</p>
              <Link
                href={`/admin/stores/${hub.storeId}`}
                className="truncate text-ink-muted hover:text-ink"
              >
                {hub.storeName}
              </Link>
              <p className="mt-1 text-xs text-ink-subtle">
                {hub.revokedAt
                  ? "Disconnected"
                  : hub.lastSeenAt
                    ? `Last active ${formatRelativeTime(hub.lastSeenAt)}`
                    : "Never seen"}
                {" · paired "}
                {formatRelativeTime(hub.pairedAt)}
              </p>
            </div>
            {!hub.revokedAt ? (
              <ConfirmActionButton
                label="Revoke"
                confirmTitle={`Revoke ${hub.name}?`}
                confirmBody={`This tablet will stop working for ${hub.storeName} until they pair again.`}
                confirmLabel="Revoke device"
                tone="danger"
                onConfirm={async () => {
                  const result = await adminRevokeHubDeviceAction(hub.id);
                  if (!result.error) router.refresh();
                  return result;
                }}
              />
            ) : (
              <span className="text-xs font-medium text-ink-subtle">Revoked</span>
            )}
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
