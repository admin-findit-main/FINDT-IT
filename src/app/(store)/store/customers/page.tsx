import { Panel } from "@/components/dashboard/shell";
import { StoreCustomerMessageForm } from "@/components/store/customer-message-form";
import { StoreCustomersDirectory } from "@/components/store/store-customers-directory";
import { getStoreCustomersAction } from "@/lib/services/loyalty";
import { getStoreMessageAudienceAction } from "@/lib/services/store-customer-messages";
import { getStoreWorkspaceAction } from "@/lib/services/actions";

export default async function StoreCustomersPage() {
  const [result, audience, workspace] = await Promise.all([
    getStoreCustomersAction({ visit: "all", sort: "last_seen_desc" }),
    getStoreMessageAudienceAction(),
    getStoreWorkspaceAction(),
  ]);

  if ("error" in result && result.error && result.rows.length === 0) {
    return <p className="text-sm text-ink-muted">{result.error}</p>;
  }

  const storeName = workspace?.store?.name || "this store";
  const reachable = "count" in audience ? audience.count : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="mt-1 text-sm text-ink-muted">
          People who earned points at{" "}
          <span className="font-medium text-ink">{storeName}</span>. Filter by
          visit or birthday month.
        </p>
      </div>

      <Panel title="Message customers">
        <StoreCustomerMessageForm
          initialCount={reachable}
          storeName={storeName}
        />
      </Panel>

      <Panel title="Store customers">
        <StoreCustomersDirectory
          initialRows={result.rows}
          initialNextCursor={result.nextCursor}
          storeName={storeName}
        />
      </Panel>
    </div>
  );
}
