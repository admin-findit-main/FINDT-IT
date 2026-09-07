import { Panel } from "@/components/dashboard/shell";
import { RewardSettingsForm } from "@/components/store/reward-settings-form";
import { getStoreRewardSettingsAction } from "@/lib/services/loyalty";

export default async function StoreRewardsPage() {
  const settings = await getStoreRewardSettingsAction();
  if (!settings) {
    return (
      <p className="text-sm text-ink-muted">
        Only owners and managers can manage store rewards.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rewards</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A simple store-funded points program for confirmed purchases.
        </p>
      </div>
      <Panel title="Points settings">
        <RewardSettingsForm initial={settings} />
      </Panel>
    </div>
  );
}
