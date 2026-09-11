import { Panel } from "@/components/dashboard/shell";
import { RewardSettingsForm } from "@/components/store/reward-settings-form";
import { getStoreRewardSettingsAction } from "@/lib/services/loyalty";
import { getStoreWorkspaceAction } from "@/lib/services/actions";

export default async function StoreRewardsPage() {
  const [settings, workspace] = await Promise.all([
    getStoreRewardSettingsAction(),
    getStoreWorkspaceAction(),
  ]);
  if (!settings) {
    return (
      <p className="text-sm text-ink-muted">
        Only owners and managers can manage store rewards.
      </p>
    );
  }

  const storeName = workspace?.store?.name || "This store";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Store rewards</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Points your location funds when the Hub confirms a purchase at{" "}
          <span className="font-medium text-ink">{storeName}</span>. This is{" "}
          <span className="font-medium text-ink">not</span> FINDIT Points — those are
          platform rewards customers earn separately in the shopper app.
        </p>
      </div>
      <Panel title="Your store’s loyalty settings">
        <RewardSettingsForm initial={settings} />
      </Panel>
    </div>
  );
}
