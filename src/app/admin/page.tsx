import { redirect } from "next/navigation";
import { Card, EmptyState } from "@/components/ui/primitives";
import { Overline } from "@/components/ui/glass";
import {
  getAdminStatsAction,
  getCurrentProfile,
  getPilotAdminStatsAction,
} from "@/lib/services/actions";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { AdminStoreApplications } from "./store-applications";
import { AdminWorkspaceLinks } from "./workspace-links";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") redirect("/home");
  const [stats, pilot] = await Promise.all([
    getAdminStatsAction(),
    getPilotAdminStatsAction(),
  ]);
  if (!stats) redirect("/home");

  return (
    <div className="app-canvas min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Overline>Admin · Pilot</Overline>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
              Is FINDIT working?
            </h1>
          </div>
          <AdminWorkspaceLinks />
        </div>

        {pilot ? (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total customers", pilot.totalCustomers],
                ["Approved stores", pilot.approvedStores],
                ["Pending applications", pilot.pendingApplications],
                ["Active requests", pilot.activeRequests],
                ["Completed requests", pilot.completedRequests],
                ["Requests today", pilot.requestsToday],
                ["Response rate", `${pilot.responseRate}%`],
                ["Successful-find rate", `${pilot.successfulFindRate}%`],
                [
                  "Avg first response",
                  formatDurationSeconds(pilot.avgFirstResponseSeconds),
                ],
                [
                  "Median first response",
                  formatDurationSeconds(pilot.medianFirstResponseSeconds),
                ],
                ["Stores responding today", pilot.storesRespondingToday],
              ].map(([label, value]) => (
                <Card key={String(label)} className="p-4">
                  <Overline>{label}</Overline>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                    {value}
                  </p>
                </Card>
              ))}
            </div>

            <Card sheen className="mt-8 p-5 sm:p-6">
              <h2 className="font-semibold text-ink">Pilot funnel</h2>
              <ol className="mt-4 space-y-2 text-sm">
                {[
                  ["Requests created", pilot.funnel.created],
                  ["Requests routed", pilot.funnel.routed],
                  ["At least one response", pilot.funnel.withResponse],
                  ["Received IN STOCK", pilot.funnel.withInStock],
                  ["Customer confirmed found", pilot.funnel.confirmedFound],
                ].map(([label, value], i) => (
                  <li
                    key={String(label)}
                    className="glass-subtle flex items-center gap-3 rounded-glass-lg px-3 py-2.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-inverse">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-ink-muted">{label}</span>
                    <span className="font-bold tabular-nums text-ink">{value}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="font-semibold text-ink">Top searched categories</h2>
                {pilot.topCategories.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    title="No category data yet"
                    description="Categories appear as customers add them to requests."
                  />
                ) : (
                  <ul className="mt-4 divide-y divide-hairline-strong text-sm">
                    {pilot.topCategories.map((c) => (
                      <li key={c.name} className="flex justify-between gap-3 py-2.5">
                        <span className="text-ink-muted">{c.name}</span>
                        <span className="font-bold tabular-nums text-ink">
                          {c.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold text-ink">Top searched products</h2>
                {pilot.topProducts.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    title="No product searches yet"
                    description="Product demand shows up here after real requests."
                  />
                ) : (
                  <ul className="mt-4 divide-y divide-hairline-strong text-sm">
                    {pilot.topProducts.map((p) => (
                      <li key={p.name} className="flex justify-between gap-3 py-2.5">
                        <span className="capitalize text-ink-muted">{p.name}</span>
                        <span className="font-bold tabular-nums text-ink">
                          {p.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold text-ink">
                  Requests with zero responses
                </h2>
                {pilot.zeroResponseRequests.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">
                    Every routed request has at least one response — or none are waiting.
                  </p>
                ) : (
                  <ul className="mt-4 max-h-64 divide-y divide-hairline-strong overflow-y-auto text-sm">
                    {pilot.zeroResponseRequests.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 py-2.5">
                        <span className="text-ink">{r.product_name}</span>
                        <span className="shrink-0 text-ink-muted">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold text-ink">Store performance</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Overline>Highest performing</Overline>
                    {pilot.highestPerformingStores.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-muted">
                        No store data yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {pilot.highestPerformingStores.map((s) => (
                          <li key={s.id} className="flex justify-between gap-3">
                            <span className="text-ink">{s.name}</span>
                            <span className="shrink-0 text-ink-muted">
                              {s.responseRate}% · {s.finds} finds
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <Overline>Slowest responding</Overline>
                    {pilot.slowestStores.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-muted">
                        No timing data yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {pilot.slowestStores.map((s) => (
                          <li key={s.id} className="flex justify-between gap-3">
                            <span className="text-ink">{s.name}</span>
                            <span className="shrink-0 text-ink-muted">
                              {formatDurationSeconds(s.avgSeconds)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <AdminStoreApplications applications={stats.storeApplications || []} />
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Users</h2>
            <div className="mt-4 max-h-80 divide-y divide-hairline-strong overflow-y-auto text-sm">
              {stats.users.map((u) => (
                <div key={u.id} className="flex justify-between gap-3 py-2.5">
                  <span className="text-ink">
                    {u.first_name || u.display_name} · {u.email}
                  </span>
                  <span className="shrink-0 capitalize text-ink-muted">
                    {u.account_type}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Stores</h2>
            <div className="mt-4 max-h-80 divide-y divide-hairline-strong overflow-y-auto text-sm">
              {stats.stores.map((s) => (
                <div key={s.id} className="flex justify-between gap-3 py-2.5">
                  <span className="text-ink">{s.name}</span>
                  <span className="shrink-0 text-ink-muted">
                    {s.is_suspended ? "Suspended" : s.is_active ? "Active" : "Inactive"}
                    {s.trial_ends_at ? " · Trial" : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="font-semibold text-ink">Recent requests</h2>
            <div className="mt-4 max-h-96 divide-y divide-hairline-strong overflow-y-auto text-sm">
              {stats.requests.map((r) => (
                <div key={r.id} className="flex justify-between gap-3 py-2.5">
                  <span className="text-ink">{r.product_name}</span>
                  <span className="shrink-0 capitalize text-ink-muted">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
