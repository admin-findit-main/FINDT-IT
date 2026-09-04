"use server";

import {
  getStoreDemandAction,
  getStoreIncomingRequestsAction,
  getStoreMetricsAction,
  getStoreSettingsAction,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { listStoreDevicesAction } from "@/lib/services/hub-devices";
import { getStoreUsageSnapshotAction } from "@/lib/visits/engine";

type Incoming = Awaited<ReturnType<typeof getStoreIncomingRequestsAction>>;
type Settings = Awaited<ReturnType<typeof getStoreSettingsAction>>;
type Metrics = Awaited<ReturnType<typeof getStoreMetricsAction>>;
type Demand = Awaited<ReturnType<typeof getStoreDemandAction>>;

export type StoreOverview =
  | { mode: "employee" }
  | { mode: "no-store" }
  | {
      mode: "owner";
      storeName: string;
      metrics: Metrics;
      requests: Incoming;
      demand: Demand;
      hubConnected: boolean;
      hours: NonNullable<Settings>["hours"] | null;
      verifiedCustomers: number | null;
      estimatedBill: string | null;
    };

/**
 * Everything the owner dashboard renders, in one round trip.
 *
 * Each action below re-derives the caller's identity, but `getCurrentProfile`
 * and `getUserStoresAction` are wrapped in React `cache()`, which dedupes
 * within a single request. Fetching them together here therefore costs one
 * auth pass instead of the eight the client used to trigger by awaiting each
 * action separately from the browser.
 *
 * Time-dependent labels (the greeting, open/closed) are deliberately left to
 * the caller: resolving them here would use the server's clock rather than the
 * viewer's.
 */
export async function getStoreOverviewAction(): Promise<StoreOverview> {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canManageStore) return { mode: "employee" };

  const store = workspace.store;
  if (!store?.id) return { mode: "no-store" };

  const [metrics, requests, demand, settings, devices, usage] = await Promise.all([
    getStoreMetricsAction(store.id),
    getStoreIncomingRequestsAction(store.id, "all", "7d"),
    getStoreDemandAction(store.id),
    getStoreSettingsAction(store.id),
    listStoreDevicesAction(),
    getStoreUsageSnapshotAction(),
  ]);

  return {
    mode: "owner",
    storeName: store.name || "",
    metrics,
    requests,
    demand,
    hubConnected: devices.some((device) => !device.revoked_at),
    hours: settings?.hours ?? null,
    verifiedCustomers: usage?.visits ?? null,
    estimatedBill: usage?.formatBilled ?? null,
  };
}
