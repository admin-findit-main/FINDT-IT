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
  const locationCount = workspace?.stores?.length ?? 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rewards</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Loyalty points funded by {storeName}.
          {locationCount > 1
            ? " Switch locations in the sidebar to edit another store."
            : null}{" "}
          These are not FINDIT Points.
        </p>
      </div>
      <Panel title="Loyalty settings">
        <RewardSettingsForm storeName={storeName} initial={settings} />
      </Panel>
    </div>
  );
}
