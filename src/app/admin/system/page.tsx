import { Panel } from "@/components/dashboard/shell";
import { isSupabaseConfigured, isDemoMode, isPilotMode } from "@/lib/config/env";

export default function AdminSystemPage() {
  return (
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
          <dd>FastSpring sandbox — live charges stay off until launch</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Secrets</dt>
          <dd>Never displayed on this page</dd>
        </div>
      </dl>
    </Panel>
  );
}
