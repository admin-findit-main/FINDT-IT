import { redirect } from "next/navigation";
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminStat,
} from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminSystemHealthAction } from "@/lib/admin/ops-actions";
import { isDemoMode, isPilotMode, isSupabaseConfigured } from "@/lib/config/env";
import { getCurrentProfile } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminSystemPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");

  const health = await getAdminSystemHealthAction();

  return (
    <AdminPage
      title="System"
      subtitle="Live operator health. Secrets are never shown here."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          label="Database"
          value={
            health?.database === "ok"
              ? "OK"
              : health?.database === "demo"
                ? "Demo"
                : "Error"
          }
          tone={
            health?.database === "ok"
              ? "ok"
              : health?.database === "error"
                ? "accent"
                : "warn"
          }
          hint={
            health?.dbMs != null ? `${health.dbMs} ms probe` : "Service role probe"
          }
        />
        <AdminStat
          label="Environment"
          value={isDemoMode() ? "Demo" : isPilotMode() ? "Pilot" : "Live"}
        />
        <AdminStat
          label="Supabase"
          value={isSupabaseConfigured() ? "Configured" : "Missing"}
          tone={isSupabaseConfigured() ? "ok" : "accent"}
        />
        <AdminStat
          label="Checked"
          value={health ? formatRelativeTime(health.checkedAt) : "—"}
          hint={health ? `${health.totalMs} ms total` : undefined}
        />
      </div>

      <AdminPanel title="Operator notes">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">App</dt>
            <dd className="font-medium">FINDIT web</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Realtime</dt>
            <dd className="font-medium">
              Postgres changes on request_targets and store_responses
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Billing controls</dt>
            <dd className="font-medium">Managed from Billing</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Health route</dt>
            <dd className="font-medium">/api/health</dd>
          </div>
        </dl>
        {!isSupabaseConfigured() ? (
          <div className="mt-4">
            <AdminEmpty
              title="Supabase keys missing"
              body="Set URL and service role in the environment before live ops."
            />
          </div>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
