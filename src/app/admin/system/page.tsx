import { Panel } from "@/components/dashboard/shell";
import { AdminUsagePricingForm } from "@/components/admin/usage-pricing-form";
import { isSupabaseConfigured, isDemoMode, isPilotMode } from "@/lib/config/env";

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
    <Panel title="Operator health">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">App</dt>
          <dd>FINDIT web · 0.1.0</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Environment</dt>
          <dd>{isDemoMode() ? "Demo" : isPilotMode() ? "Pilot" : "Live"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Supabase</dt>
          <dd>{isSupabaseConfigured() ? "Configured" : "Missing keys"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Realtime</dt>
          <dd>Postgres changes on request_targets and store_responses</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Billing</dt>
          <dd>Usage engine on · payment collection off</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Health</dt>
          <dd>/api/health — app and database probe</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Secrets</dt>
          <dd>Never displayed on this page</dd>
        </div>
      </dl>
    </Panel>
    <Panel title="Usage pricing">
      <AdminUsagePricingForm />
    </Panel>
    </div>
  );
}
