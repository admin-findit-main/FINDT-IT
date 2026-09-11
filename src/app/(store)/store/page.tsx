import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CreditCard,
  Gift,
  MessageSquareReply,
  Monitor,
  PackageSearch,
  Settings,
  Tablet,
  Users,
  BarChart3,
} from "lucide-react";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { StoreGreeting, StoreOpenLabel } from "@/components/store/owner-clock";
import {
  getStoreOverviewAction,
  type StoreOverview,
} from "@/lib/services/store-overview";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { formatRelativeTime } from "@/lib/utils";

type OwnerData = Extract<StoreOverview, { mode: "owner" }>;

function delta(today: number, yesterday: number) {
  if (!yesterday) return today ? "New vs yesterday" : "No traffic yesterday";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs yesterday`;
}

const QUICK_LINKS: {
  href: string;
  label: string;
  body: string;
  icon: typeof PackageSearch;
}[] = [
  {
    href: "/store/requests",
    label: "Requests",
    body: "Answer nearby asks",
    icon: PackageSearch,
  },
  {
    href: "/store/responses",
    label: "Responses",
    body: "What you already answered",
    icon: MessageSquareReply,
  },
  {
    href: "/store/demand",
    label: "Demand",
    body: "Products people keep asking for",
    icon: BarChart3,
  },
  {
    href: "/store/customers",
    label: "Customers",
    body: "Loyalty balances at this store",
    icon: Users,
  },
  {
    href: "/store/rewards",
    label: "Rewards",
    body: "Points per dollar and thresholds",
    icon: Gift,
  },
  {
    href: "/store/shifts",
    label: "Staff",
    body: "Floor PINs, hours, and login access",
    icon: CalendarClock,
  },
  {
    href: "/store/hub",
    label: "FINDIT Hub",
    body: "Counter tablet for asks and points",
    icon: Tablet,
  },
  {
    href: "/store/devices",
    label: "Devices",
    body: "Pair and manage Hub tablets",
    icon: Monitor,
  },
  {
    href: "/store/notifications",
    label: "Notifications",
    body: "Alerts and browser push",
    icon: Bell,
  },
  {
    href: "/store/settings",
    label: "Settings",
    body: "Hours, coverage, categories",
    icon: Settings,
  },
  {
    href: "/store/subscription",
    label: "Billing",
    body: "Trial and subscription status",
    icon: CreditCard,
  },
];

function OwnerOverview({ data }: { data: OwnerData }) {
  const {
    storeName,
    metrics,
    requests,
    demand,
    hubConnected,
    hours,
  } = data;

  const waiting = requests.filter((i) => !i.response);
  const missed = demand
    .filter((d) => d.out_of_stock_count > 0)
    .sort((a, b) => b.out_of_stock_count - a.out_of_stock_count)
    .slice(0, 5);
  const top = [...demand].sort((a, b) => b.request_count - a.request_count).slice(0, 5);
  const rate =
    metrics.requests_today > 0
      ? `${Math.round((metrics.answered_today / metrics.requests_today) * 1000) / 10}%`
      : "—";

  return (
    <div className="space-y-6">
      <div>
        <StoreGreeting />
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{storeName || "Store"}</h1>
        <StoreOpenLabel hours={hours} />
      </div>

      <div className="rounded-2xl border border-hairline-strong bg-white px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold text-ink">
          {hubConnected ? "FINDIT Hub connected" : "Open your store"}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {hubConnected
            ? "Use the Hub on the counter for customer points and live asks. Manage everything else from this dashboard."
            : "Connect a counter tablet, invite staff, and confirm hours so you can answer Asks."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/store/hub"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#E5231B] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            {hubConnected ? "Open FINDIT Hub" : "Connect FINDIT Hub"}
          </Link>
          <Link
            href="/store/shifts?tab=access"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline-strong px-4 py-2 text-center text-sm font-semibold text-ink"
          >
            Invite staff
          </Link>
          <Link
            href="/store/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline-strong px-4 py-2 text-center text-sm font-semibold text-ink"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Waiting"
          value={metrics.waiting_today}
          hint={`${metrics.requests_today} received today`}
        />
        <MetricCard
          label="Answered today"
          value={metrics.answered_today}
          hint={delta(metrics.answered_today, metrics.answered_yesterday)}
        />
        <MetricCard label="Response rate" value={rate} hint="Today, this location" />
        <MetricCard
          label="Avg response time"
          value={
            metrics.avg_response_minutes != null
              ? formatDurationSeconds(metrics.avg_response_minutes * 60)
              : "—"
          }
          hint={`${metrics.week_customer_finds} potential customers found this week`}
        />
      </div>

      {waiting.length ? (
        <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-[#E5231B]/20 bg-[#FFF1F0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm font-semibold text-[#C81109]">
              {waiting.length} request{waiting.length === 1 ? "" : "s"} waiting
            </p>
            <p className="text-xs text-ink-muted">Unanswered asks for this store.</p>
          </div>
          <Link
            href="/store/requests"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#E5231B] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            View requests
          </Link>
        </div>
      ) : null}

      <Panel title="Everything in Business">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[4.5rem] gap-3 rounded-xl border border-hairline-strong bg-[var(--solid-chrome)] px-3.5 py-3 transition hover:border-black/15 hover:bg-white"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm">
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink-muted">
                    {item.body}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent requests"
          action={
            <Link href="/store/requests" className="text-xs font-medium text-ink-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {requests.length === 0 ? (
            <p className="text-sm text-ink-muted">No requests in the last 7 days.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {requests.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/store/requests/${row.id}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[#C81109]"
                  >
                    <span className="truncate font-medium">{row.product_name}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {row.response?.response_type?.replace("_", " ") || "Waiting"} ·{" "}
                      {formatRelativeTime(row.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Demand snapshot"
          action={
            <Link href="/store/demand" className="text-xs font-medium text-ink-muted hover:text-ink">
              Full demand
            </Link>
          }
        >
          {top.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Not enough data yet. Insights appear after nearby customers start asking.
            </p>
          ) : (
            <ol className="space-y-3 text-sm">
              {top.map((item, i) => (
                <li key={item.normalized_product_name} className="flex justify-between gap-3">
                  <span>
                    {i + 1}. {item.product_name}
                  </span>
                  <span className="tabular-nums text-ink-muted">{item.request_count}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel
        title="Missed opportunities"
        action={
          <Link href="/store/demand" className="text-xs font-medium text-ink-muted hover:text-ink">
            Demand
          </Link>
        }
      >
        {missed.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No repeated out-of-stock patterns yet. This fills in as you answer asks.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {missed.map((item) => (
              <li key={item.normalized_product_name} className="flex justify-between gap-3">
                <span>{item.product_name}</span>
                <span className="text-ink-muted">
                  {item.request_count} asks · {item.out_of_stock_count} out of stock
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * Server component, matching /admin.
 *
 * Awaiting here moves the store overview round trip to the server so markup
 * arrives with numbers already in it. (store)/loading.tsx covers the wait.
 */
export default async function StoreHomePage() {
  const overview = await getStoreOverviewAction();

  if (overview.mode === "employee") redirect("/store/hub");

  if (overview.mode === "no-store") {
    return (
      <p className="text-sm text-ink-muted">No store is linked to this account.</p>
    );
  }

  return <OwnerOverview data={overview} />;
}
