"use client";

import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { AdminEmpty } from "@/components/admin/ui";
import { setProfileSuspendedAction } from "@/lib/admin/directory";
import type { AdminPersonRow } from "@/lib/admin/directory";

export function AdminPeopleTable({ rows }: { rows: AdminPersonRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <AdminEmpty title="None yet" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-subtle">
          <tr>
            <th className="py-2 pr-3 font-semibold">Name</th>
            <th className="py-2 pr-3 font-semibold">Email</th>
            <th className="py-2 pr-3 font-semibold">Plan</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.06]">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-3 pr-3">
                <p className="font-medium">{row.name}</p>
                {row.storeName ? (
                  <p className="text-xs text-ink-muted">{row.storeName}</p>
                ) : null}
              </td>
              <td className="py-3 pr-3 text-ink-muted">{row.email || "—"}</td>
              <td className="py-3 pr-3 capitalize">{row.plan}</td>
              <td className="py-3 pr-3">
                {row.suspended ? "Suspended" : "Active"}
              </td>
              <td className="py-3">
                <ConfirmActionButton
                  label={row.suspended ? "Restore" : "Suspend"}
                  confirmTitle={
                    row.suspended
                      ? `Restore ${row.name || "this account"}?`
                      : `Suspend ${row.name || "this account"}?`
                  }
                  confirmBody={
                    row.suspended
                      ? "They will be able to sign in and use FINDIT again."
                      : "They will be blocked from signing in until you restore access."
                  }
                  confirmLabel={row.suspended ? "Restore access" : "Suspend account"}
                  tone={row.suspended ? "success" : "danger"}
                  onConfirm={async () => {
                    const result = await setProfileSuspendedAction(
                      row.id,
                      !row.suspended
                    );
                    if (!result.error) router.refresh();
                    return result;
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
