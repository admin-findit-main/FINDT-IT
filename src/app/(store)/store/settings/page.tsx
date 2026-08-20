"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { GlassBadge, GlassChip, GlassNotice } from "@/components/ui/glass";
import {
  DAYS_OF_WEEK,
  PILOT_STORE_BANNER,
  STORE_PLANS,
  STORE_SERVICE_RADIUS_OPTIONS,
} from "@/lib/config/constants";
import {
  getStoreSettingsAction,
  getUserStoresAction,
  updateStoreCoverageAction,
  updateStoreProfileAction,
} from "@/lib/services/actions";
import { JOIN_REQUEST_CATEGORIES as CATS } from "@/lib/services/category-routing";
import { IosSwitch } from "@/components/ui/ios-switch";
import type { Store } from "@/types/database";

export default function StoreSettingsPage() {
  const [store, setStore] = useState<(Store & { role: string }) | null>(null);
  const [role, setRole] = useState<string>("employee");
  const [hours, setHours] = useState<
    {
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }[]
  >([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [serviceZips, setServiceZips] = useState("");
  const [radius, setRadius] = useState(10);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [pilotBanner, setPilotBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requiresCustomerId, setRequiresCustomerId] = useState(false);

  const canManage = role === "owner" || role === "manager";

  useEffect(() => {
    getUserStoresAction()
      .then(async (s) => {
        const first = s[0] || null;
        setStore(first);
        if (!first) return;
        const settings = await getStoreSettingsAction(first.id);
        if (!settings) return;
        setRole(settings.role);
        setHours(
          settings.hours.length
            ? settings.hours
            : Array.from({ length: 7 }, (_, day) => ({
                day_of_week: day,
                open_time: day === 0 ? null : "09:00",
                close_time: day === 0 ? null : "21:00",
                is_closed: day === 0,
              }))
        );
        setCategories(settings.categories);
        setServiceZips(settings.serviceZips.join(", "));
        setRadius(settings.store.service_radius_miles || 10);
        setPilotBanner(settings.pilotMode);
        setName(settings.store.name || "");
        setDescription(settings.store.description || "");
        setPhone(settings.store.phone || "");
        setWebsite(settings.store.website || "");
        setStreet(settings.store.street_address || "");
        setCity(settings.store.city || "");
        setRegion(settings.store.state || "");
        setPostal(settings.store.postal_code || "");
        setRequiresCustomerId(Boolean(settings.store.age_restricted));
        setStore({ ...settings.store, role: settings.role });
      })
      .catch((err) => {
        console.error("[FINDIT] store settings load failed", err);
      });
  }, []);

  async function saveCoverage() {
    if (!store || !canManage) return;
    setSaving(true);
    const zips = serviceZips
      .split(/[,\s]+/)
      .map((z) => z.trim())
      .filter(Boolean);
    const result = await updateStoreCoverageAction(store.id, {
      serviceRadiusMiles: radius,
      serviceZips: zips,
      categories,
      hours,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await updateStoreProfileAction(store.id, {
      ageRestricted: requiresCustomerId,
    });
    toast.success("Store coverage saved");
  }

  async function saveProfile() {
    if (!store || !canManage) return;
    setSaving(true);
    const result = await updateStoreProfileAction(store.id, {
      name,
      description,
      phone,
      website,
      streetAddress: street,
      city,
      state: region,
      postalCode: postal,
      ageRestricted: requiresCustomerId,
    });
    setSaving(false);
    if (result.error) toast.error(result.error);
    else toast.success("Store profile saved");
  }

  const plan = STORE_PLANS[(store?.subscription_plan as keyof typeof STORE_PLANS) || "free"];

  const sections = [
    { href: "/store/settings#profile", title: "Business Profile", body: "Name, address, phone, website" },
    { href: "/store/settings#hours", title: "Business Hours", body: "Configure each day of the week" },
    { href: "/store/settings#area", title: "Service Area", body: "ZIP codes and radius you serve" },
    { href: "/store/settings#categories", title: "Request Categories", body: "What requests you receive" },
    ...(canManage
      ? [{ href: "/store/team", title: "Team", body: "Invite employees and managers" }]
      : []),
    { href: "/store/notifications", title: "Notifications", body: "New request and demand alerts" },
    ...(role === "owner" || role === "manager"
      ? [{ href: "/store/settings#plan", title: "Plan", body: "Pilot trial, Starter, and Pro" }]
      : []),
    { href: "/store/account", title: "Account", body: "Your login and role for this store" },
  ];

  return (
    <div>
      <p className="text-sm text-ink-muted">{store?.name}</p>
      {pilotBanner ? (
        <GlassNotice tone="stock" className="mt-3">
          {PILOT_STORE_BANNER}
        </GlassNotice>
      ) : null}

      {!canManage ? (
        <GlassNotice className="mt-4">
          You’re signed in as an employee. Ask an owner or manager to change store settings.
        </GlassNotice>
      ) : null}

      <Card sheen id="profile" className="mt-6 space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Business profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Store name</Label>
            <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={description} disabled={!canManage} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} disabled={!canManage} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} disabled={!canManage} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Street</Label>
            <Input value={street} disabled={!canManage} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} disabled={!canManage} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={region} disabled={!canManage} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div>
            <Label>ZIP</Label>
            <Input value={postal} disabled={!canManage} onChange={(e) => setPostal(e.target.value)} />
          </div>
        </div>
        {canManage ? (
          <Button onClick={saveProfile} disabled={saving}>
            Save profile
          </Button>
        ) : null}
      </Card>

      <div className="mt-6 space-y-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card interactive className="mb-3 p-5">
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card sheen id="hours" className="mt-8 scroll-mt-8 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Business hours</h2>
        <div className="mt-4 space-y-3">
          {DAYS_OF_WEEK.map((day, idx) => {
            const row = hours.find((h) => h.day_of_week === idx) || {
              day_of_week: idx,
              open_time: "09:00",
              close_time: "21:00",
              is_closed: false,
            };
            return (
              <div key={day} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-sm">
                <span className="font-medium text-ink">{day.slice(0, 3)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      checked={row.is_closed}
                      onChange={(e) => {
                        setHours((prev) => {
                          const next = prev.filter((h) => h.day_of_week !== idx);
                          next.push({
                            ...row,
                            is_closed: e.target.checked,
                            open_time: e.target.checked ? null : row.open_time || "09:00",
                            close_time: e.target.checked ? null : row.close_time || "21:00",
                          });
                          return next;
                        });
                      }}
                    />
                    Closed
                  </label>
                  {!row.is_closed ? (
                    <>
                      <Input
                        type="time"
                        className="h-10 w-[7.5rem]"
                        disabled={!canManage}
                        value={(row.open_time || "09:00").slice(0, 5)}
                        onChange={(e) => {
                          setHours((prev) => {
                            const next = prev.filter((h) => h.day_of_week !== idx);
                            next.push({ ...row, open_time: e.target.value });
                            return next;
                          });
                        }}
                      />
                      <span className="text-ink-subtle">to</span>
                      <Input
                        type="time"
                        className="h-10 w-[7.5rem]"
                        disabled={!canManage}
                        value={(row.close_time || "21:00").slice(0, 5)}
                        onChange={(e) => {
                          setHours((prev) => {
                            const next = prev.filter((h) => h.day_of_week !== idx);
                            next.push({ ...row, close_time: e.target.value });
                            return next;
                          });
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card sheen id="area" className="mt-4 scroll-mt-8 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Service coverage</h2>
        <div className="mt-4">
          <Label>Service radius</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STORE_SERVICE_RADIUS_OPTIONS.map((o) => (
              <GlassChip
                key={o.miles}
                disabled={!canManage}
                selected={radius === o.miles}
                onClick={() => setRadius(o.miles)}
                className="disabled:opacity-50"
              >
                {o.label}
              </GlassChip>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="zips">Service ZIP codes</Label>
          <Input
            id="zips"
            disabled={!canManage}
            value={serviceZips}
            onChange={(e) => setServiceZips(e.target.value)}
            placeholder="22044, 22042, 22046"
          />
        </div>
      </Card>

      <Card sheen id="categories" className="mt-4 scroll-mt-8 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Request categories</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(CATS as readonly string[]).map((c) => (
            <GlassChip
              key={c}
              disabled={!canManage}
              selected={categories.includes(c)}
              onClick={() =>
                setCategories((prev) =>
                  prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                )
              }
              className="disabled:opacity-50"
            >
              {c}
            </GlassChip>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-glass-md bg-glass-1 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Require a government ID</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Tobacco, vape, and similar products. Customers confirm they are 21+
              before FINDIT sends the ask. You still check ID in the store.
            </p>
          </div>
          <IosSwitch
            label="Require a government ID"
            checked={requiresCustomerId}
            disabled={!canManage}
            onCheckedChange={setRequiresCustomerId}
          />
        </div>
      </Card>

      {canManage ? (
        <Button className="mt-4 w-full" disabled={saving} onClick={saveCoverage}>
          {saving ? "Saving…" : "Save hours & coverage"}
        </Button>
      ) : null}

      {(role === "owner" || role === "manager") && (
        <Card sheen id="plan" className="mt-8 scroll-mt-8 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Current plan</h2>
          <div className="mt-2">
            <GlassBadge
              tone="stock"
              className="text-[11px] font-bold uppercase tracking-wide"
            >
              Pilot · no credit card required
            </GlassBadge>
          </div>
          <p className="mt-3 text-2xl font-bold text-ink">{plan.name}</p>
          <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
          {store?.trial_ends_at ? (
            <p className="mt-2 text-sm text-ink-muted">
              Pilot ends {new Date(store.trial_ends_at).toLocaleDateString()}
            </p>
          ) : null}
        </Card>
      )}

      <Card sheen id="profile" className="mt-4 scroll-mt-8 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Business profile</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Address</dt>
            <dd className="text-right text-ink">
              {store
                ? `${store.street_address}, ${store.city}, ${store.state} ${store.postal_code}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Phone</dt>
            <dd className="text-ink">{store?.phone || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Verified</dt>
            <dd className="text-ink">
              {store?.is_verified ? "Verified FINDIT store" : "Unverified"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
