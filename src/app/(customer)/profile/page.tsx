"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassBadge, Overline } from "@/components/ui/glass";
import { Card, Input, Label } from "@/components/ui/primitives";
import { CUSTOMER_PLANS } from "@/lib/config/constants";
import {
  getCurrentProfile,
  getCustomerPlanUsageAction,
  getAppWorkspaceAction,
  getUserStoresAction,
  signOutAction,
  updateProfileAction,
} from "@/lib/services/actions";
import type { Profile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasStore, setHasStore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<Awaited<
    ReturnType<typeof getCustomerPlanUsageAction>
  > | null>(null);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
    getUserStoresAction().then((stores) => setHasStore(stores.length > 0));
    getAppWorkspaceAction().then((ws) => {
      if (!ws) return;
      setHasStore(ws.hasStore);
      setIsAdmin(ws.isAdmin);
    });
    getCustomerPlanUsageAction().then(setUsage);
  }, []);

  if (!profile) {
    return <div className="px-5 pt-8 text-sm text-ink-muted">Loading profile…</div>;
  }

  const currentPlan =
    CUSTOMER_PLANS[profile.subscription_plan === "plus" ? "plus" : "free"];

  return (
    <div className="px-5 pt-6 pb-10 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>
        {hasStore || profile.account_type === "business" ? (
          <GlassBadge>Also on a store team</GlassBadge>
        ) : null}
        {isAdmin ? <GlassBadge tone="ink">Admin</GlassBadge> : null}
      </div>

      <Card level="subtle" className="mt-4 space-y-3 p-5">
        <p className="text-sm font-semibold text-ink">Shortcuts</p>
        {hasStore || profile.account_type === "business" ? (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/store">Open store inbox</Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-ink-muted">
              Own a business? Apply separately — floor staff join via an invite
              from their owner.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/join">Apply your business</Link>
            </Button>
          </div>
        )}
        {isAdmin ? (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/admin">Admin overview</Link>
          </Button>
        ) : null}
      </Card>

      <Card level="strong" sheen className="mt-6 space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Overline>Your plan</Overline>
            <h2 className="mt-1 text-xl font-bold text-ink">{currentPlan.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">{currentPlan.tagline}</p>
            {usage && usage.limit != null && !usage.bypassed ? (
              <p className="mt-2 text-sm text-ink-muted">
                {usage.used} / {usage.limit} requests used this month
              </p>
            ) : usage?.bypassed ? (
              <p className="mt-2 text-xs font-medium text-stock-ink">
                Pilot: request limits are off for testing.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Unlimited requests</p>
            )}
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-ink">
            {currentPlan.priceMonthly
              ? `$${currentPlan.priceMonthly}/mo`
              : "$0"}
          </p>
        </div>

        <div className="grid gap-3 border-t border-hairline-strong pt-4 sm:grid-cols-2">
          {Object.values(CUSTOMER_PLANS).map((plan) => {
            const active = plan.id === currentPlan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-glass-lg border p-4 ${
                  active
                    ? "border-accent-ring bg-accent-soft"
                    : "border-hairline-strong bg-glass-1"
                }`}
              >
                <p className="font-semibold text-ink">{plan.name}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {plan.priceMonthly ? `$${plan.priceMonthly}/month` : "Free"}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                  <li>
                    {plan.monthlyRequests == null
                      ? "Unlimited requests"
                      : `${plan.monthlyRequests} requests / month`}
                  </li>
                  <li>Up to {plan.maxRadiusMiles} mile radius</li>
                  {plan.savedSearches ? <li>Saved searches</li> : null}
                  {plan.requestHistory ? <li>Request history</li> : null}
                  {plan.futureAlerts ? <li>Future alerts</li> : null}
                </ul>
                {!active && plan.id === "plus" ? (
                  <p className="mt-4 text-xs font-medium text-stock-ink">
                    Included in the pilot — no upgrade needed yet.
                  </p>
                ) : null}
                {active ? (
                  <p className="mt-4 text-xs font-semibold text-accent-ink">
                    Current plan
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6 space-y-4 p-5">
        <div>
          <Label>Name</Label>
          <Input
            value={profile.first_name || ""}
            onChange={(e) =>
              setProfile({ ...profile, first_name: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile.email} disabled />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Default city</Label>
            <Input
              value={profile.default_city || ""}
              onChange={(e) =>
                setProfile({ ...profile, default_city: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Default ZIP</Label>
            <Input
              value={profile.default_postal_code || ""}
              onChange={(e) =>
                setProfile({ ...profile, default_postal_code: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-3 border-t border-hairline-strong pt-4">
          <p className="text-sm font-semibold text-ink">Notification preferences</p>
          {(
            [
              ["notify_in_stock", "In Stock replies"],
              ["notify_can_order", "Can Order replies"],
              ["notify_request_expired", "Request expiration"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-glass-md bg-glass-1 px-3 py-2.5 text-sm text-ink"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(profile[key])}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.checked })
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          ))}
        </div>
        <Button
          className="w-full"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const result = await updateProfileAction({
              firstName: profile.first_name || "",
              lastName: profile.last_name || "",
              city: profile.default_city || "",
              state: profile.default_state || "VA",
              postalCode: profile.default_postal_code || "",
              notifyInStock: profile.notify_in_stock,
              notifyCanOrder: profile.notify_can_order,
              notifyRequestExpired: profile.notify_request_expired,
            });
            setSaving(false);
            if (result.error) toast.error(result.error);
            else toast.success("Saved");
          }}
        >
          Save changes
        </Button>
      </Card>

      <Card level="subtle" className="mt-4 space-y-3 p-5">
        <p className="text-sm font-semibold text-ink">Account</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await signOutAction();
            router.push("/");
            router.refresh();
          }}
        >
          Log out
        </Button>
        <p className="text-xs leading-relaxed text-ink-muted">
          Need to leave FINDIT? Email support and we&apos;ll help remove your
          account after the pilot.
        </p>
      </Card>
    </div>
  );
}
