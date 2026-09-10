"use client";

import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { AdminEmpty, AdminPanel } from "@/components/admin/ui";
import { resolveAdminReportAction } from "@/lib/admin/ops-actions";
import { formatRelativeTime } from "@/lib/utils";

export type AdminReportRow = {
  id: string;
  reason: string;
  description?: string | null;
  status: string;
  created_at: string;
  request_id?: string | null;
  store_id?: string | null;
};

export function AdminReportsQueue({ reports }: { reports: AdminReportRow[] }) {
  const router = useRouter();

  if (reports.length === 0) {
    return (
      <AdminEmpty
        title="Queue is clear"
        body="Reports from customers or stores land here for moderation."
      />
    );
  }

  return (
    <ul className="divide-y divide-black/[0.06]">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{report.reason}</p>
            {report.description ? (
              <p className="mt-1 text-sm text-ink-muted">{report.description}</p>
            ) : null}
            <p className="mt-1 text-xs text-ink-subtle">
              {report.status} · {formatRelativeTime(report.created_at)}
              {report.store_id ? ` · store ${report.store_id.slice(0, 8)}` : ""}
              {report.request_id ? ` · find ${report.request_id.slice(0, 8)}` : ""}
            </p>
          </div>
          {report.status === "pending" || report.status === "open" ? (
            <div className="flex flex-wrap gap-2">
              <ConfirmActionButton
                label="Resolve"
                confirmTitle="Resolve this report?"
                confirmBody="Marks the report as handled. You can still find it in the queue history."
                confirmLabel="Resolve"
                tone="success"
                onConfirm={async () => {
                  const result = await resolveAdminReportAction(report.id, "resolved");
                  if (!result.error) router.refresh();
                  return result;
                }}
              />
              <ConfirmActionButton
                label="Dismiss"
                confirmTitle="Dismiss this report?"
                confirmBody="Use dismiss when no action is needed. This is logged in audit."
                confirmLabel="Dismiss"
                tone="danger"
                onConfirm={async () => {
                  const result = await resolveAdminReportAction(report.id, "dismissed");
                  if (!result.error) router.refresh();
                  return result;
                }}
              />
            </div>
          ) : (
            <span className="text-xs font-medium capitalize text-ink-subtle">
              {report.status}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AdminReportsPanel({ reports }: { reports: AdminReportRow[] }) {
  return (
    <AdminPanel title={`Moderation · ${reports.length}`}>
      <AdminReportsQueue reports={reports} />
    </AdminPanel>
  );
}
