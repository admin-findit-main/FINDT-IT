"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import {
  GlassChip,
  GlassNotice,
  GlassSelect,
  VerifiedStoreBadge,
} from "@/components/ui/glass";
import { usePublicHref } from "@/components/host/host-surface";
import {
  DAYS_OF_WEEK,
  PILOT_STORE_BANNER,
  STORE_PLANS,
  STORE_SERVICE_RADIUS_OPTIONS,
} from "@/lib/config/constants";
import { AppScreenLoader } from "@/components/shared/load-progress";
import {
  getMyStoreSettingsAction,
  updateStoreCoverageAction,
  updateStoreProfileAction,
} from "@/lib/services/actions";
import {
  FINDIT_CATALOG,
  catalogTypeById,
  defaultCategoryIdsForType,
} from "@findit/domain";
import { IosSwitch } from "@/components/ui/ios-switch";
import { StoreAddressFields } from "@/components/store/store-address-fields";
import { StoreDeviceEnableList } from "@/components/store/store-device-enable-list";
import type { Store } from "@/types/database";
import {
  listStoreDevicesAction,
  type StoreDeviceView,
} from "@/lib/services/hub-devices";
import { cn } from "@/lib/utils";

type HourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

type SettingsTab = "profile" | "hours" | "coverage" | "categories" | "devices";

function clockLabel(hhmm: string) {
  const [hStr, mStr] = hhmm.slice(0, 5).split(":");
  const h = Number(hStr);
  const m = Number(mStr) || 0;
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const minutes = i * 15;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
  return { value, label: clockLabel(value) };
});

function toHm(value: string | null | undefined, fallback: string) {
  const sliced = (value || "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(sliced) ? sliced : fallback;
}

function normalizeHours(rows: HourRow[]): HourRow[] {
  return Array.from({ length: 7 }, (_, day) => {
    const existing = rows.find((h) => h.day_of_week === day);
    if (existing) {
      return {
        day_of_week: day,
        is_closed: existing.is_closed,
        open_time: toHm(existing.open_time, "09:00"),
        close_time: toHm(existing.close_time, "21:00"),
      };
    }
    return {
      day_of_week: day,
      open_time: "09:00",
      close_time: "21:00",
      is_closed: day === 0,
    };
  });
}

function timeChoices(value: string) {
  if (TIME_OPTIONS.some((o) => o.value === value)) return TIME_OPTIONS;
  return [{ value, label: clockLabel(value) }, ...TIME_OPTIONS];
}

function parseTab(hash: string): SettingsTab {
  if (
    hash === "hours" ||
    hash === "coverage" ||
    hash === "area" ||
    hash === "categories" ||
    hash === "devices" ||
    hash === "profile"
  ) {
    if (hash === "area") return "coverage";
    return hash;
  }
  return "profile";
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "hours", label: "Hours" },
  { id: "coverage", label: "Area" },
  { id: "categories", label: "Requests" },
  { id: "devices", label: "Devices" },
];

export default function StoreSettingsPage() {
  const devicesHref = usePublicHref("/store/devices");
  const accountHref = usePublicHref("/store/account");
  const billingHref = usePublicHref("/store/subscription");
  const notificationsHref = usePublicHref("/store/notifications");
  const [store, setStore] = useState<(Store & { role: string }) | null>(null);
  const [role, setRole] = useState<string>("employee");
  const [hours, setHours] = useState<HourRow[]>(() => normalizeHours([]));
  const [categories, setCategories] = useState<string[]>([]);
  const [catalogCategoryIds, setCatalogCategoryIds] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [acceptingRequests, setAcceptingRequests] = useState(true);
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
  const [ready, setReady] = useState(false);
  const [requiresCustomerId, setRequiresCustomerId] = useState(false);
  const [devices, setDevices] = useState<StoreDeviceView[]>([]);
  const [tab, setTab] = useState<SettingsTab>("profile");

  const canManage = role === "owner" || role === "manager";

  useEffect(() => {
    if (!ready) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    setTab(parseTab(hash));
  }, [ready]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyStoreSettingsAction(), listStoreDevicesAction()])
      .then(([settings, hubDevices]) => {
        if (cancelled) return;
        setDevices(hubDevices);
        if (!settings) {
          setReady(true);
          return;
        }
        setRole(settings.role);
        setHours(normalizeHours(settings.hours));
        setCategories(settings.categories);
        setCatalogCategoryIds(settings.catalogCategoryIds || []);
        setCustomKeywords((settings.customKeywords || []).join(", "));
        setBusinessType(settings.store.business_type || "");
        setAcceptingRequests(settings.store.accepting_requests !== false);
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
        setReady(true);
      })
      .catch((err) => {
        console.error("[FINDIT] store settings load failed", err);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTab(next: SettingsTab) {
    setTab(next);
    const hash = next === "profile" ? "profile" : next;
    window.history.replaceState(null, "", `#${hash}`);
  }

  function patchHour(idx: number, patch: Partial<HourRow>) {
    setHours((prev) =>
      normalizeHours(prev).map((row) =>
        row.day_of_week === idx ? { ...row, ...patch } : row
      )
    );
  }

  async function saveCoverage(fields?: {
    includeHours?: boolean;
    includeArea?: boolean;
    includeCategories?: boolean;
  }) {
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
      businessType: businessType || null,
      acceptingRequests,
      catalogCategoryIds,
      customKeywords: customKeywords
        .split(/[,\n]+/)
        .map((k) => k.trim())
        .filter(Boolean),
      hours: hours.map((h) => ({
        ...h,
        open_time: h.is_closed ? null : toHm(h.open_time, "09:00"),
        close_time: h.is_closed ? null : toHm(h.close_time, "21:00"),
      })),
    });
    if (result.error) {
      setSaving(false);
      toast.error(result.error);
      return;
    }
    if (fields?.includeCategories) {
      await updateStoreProfileAction(store.id, {
        ageRestricted: requiresCustomerId,
      });
    }
    setSaving(false);
    toast.success("Saved");
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
    else toast.success("Profile saved");
  }

  const plan =
    STORE_PLANS[(store?.subscription_plan as keyof typeof STORE_PLANS) || "free"];

  if (!ready) {
    return <AppScreenLoader label="Loading settings" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {pilotBanner ? <GlassNotice tone="stock">{PILOT_STORE_BANNER}</GlassNotice> : null}

      {!canManage ? (
        <GlassNotice>
          Only owners and managers can edit store settings.
        </GlassNotice>
      ) : null}

      <div
        role="tablist"
        aria-label="Settings"
        className="flex gap-1 overflow-x-auto rounded-xl border border-hairline-strong bg-white p-1"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(item.id)}
              className={cn(
                "min-h-10 min-w-[4.5rem] flex-1 rounded-lg px-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-[var(--fd-black)] text-ink-inverse"
                  : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "profile" ? (
        <Card className="p-5 sm:p-6">
          <form
            autoComplete="off"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="store-name">Store name</Label>
                <Input
                  id="store-name"
                  value={name}
                  disabled={!canManage}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="store-description">Description</Label>
                <Input
                  id="store-description"
                  value={description}
                  disabled={!canManage}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  type="tel"
                  value={phone}
                  disabled={!canManage}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store-website">Website</Label>
                <Input
                  id="store-website"
                  value={website}
                  disabled={!canManage}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <StoreAddressFields
                  idPrefix="store"
                  street={street}
                  city={city}
                  state={region}
                  postalCode={postal}
                  disabled={!canManage}
                  onChange={(next) => {
                    setStreet(next.street);
                    setCity(next.city);
                    setRegion(next.state);
                    setPostal(next.postalCode);
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-hairline-strong pt-4 text-sm">
              <span className="text-ink-muted">Verified</span>
              {store?.is_verified ? (
                <VerifiedStoreBadge label="Verified" />
              ) : (
                <span className="text-ink">Pending review</span>
              )}
            </div>
            {canManage ? (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            ) : null}
          </form>
        </Card>
      ) : null}

      {tab === "hours" ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day, idx) => {
              const row = hours[idx] || normalizeHours([])[idx]!;
              const openValue = toHm(row.open_time, "09:00");
              const closeValue = toHm(row.close_time, "21:00");
              return (
                <div
                  key={day}
                  className="rounded-xl border border-hairline-strong px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{day}</p>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-hairline-strong"
                        disabled={!canManage}
                        checked={!row.is_closed}
                        onChange={(e) =>
                          patchHour(idx, {
                            is_closed: !e.target.checked,
                            open_time: e.target.checked
                              ? openValue
                              : row.open_time,
                            close_time: e.target.checked
                              ? closeValue
                              : row.close_time,
                          })
                        }
                      />
                      Open
                    </label>
                  </div>
                  {!row.is_closed ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`hours-open-${idx}`}>Opens</Label>
                        <GlassSelect
                          id={`hours-open-${idx}`}
                          disabled={!canManage}
                          value={openValue}
                          className="mt-1.5"
                          onChange={(e) =>
                            patchHour(idx, { open_time: e.target.value })
                          }
                        >
                          {timeChoices(openValue).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </GlassSelect>
                      </div>
                      <div>
                        <Label htmlFor={`hours-close-${idx}`}>Closes</Label>
                        <GlassSelect
                          id={`hours-close-${idx}`}
                          disabled={!canManage}
                          value={closeValue}
                          className="mt-1.5"
                          onChange={(e) =>
                            patchHour(idx, { close_time: e.target.value })
                          }
                        >
                          {timeChoices(closeValue).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </GlassSelect>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-muted">Closed</p>
                  )}
                </div>
              );
            })}
          </div>
          {canManage ? (
            <Button
              className="mt-4"
              disabled={saving}
              onClick={() => void saveCoverage({ includeHours: true })}
            >
              {saving ? "Saving…" : "Save hours"}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {tab === "coverage" ? (
        <Card className="p-5 sm:p-6 space-y-5">
          <div>
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
          <div>
            <Label htmlFor="store-zips">ZIP codes</Label>
            <Input
              id="store-zips"
              disabled={!canManage}
              value={serviceZips}
              onChange={(e) => setServiceZips(e.target.value)}
              placeholder="22044, 22042"
              className="mt-1.5"
            />
          </div>
          {canManage ? (
            <Button
              disabled={saving}
              onClick={() => void saveCoverage({ includeArea: true })}
            >
              {saving ? "Saving…" : "Save area"}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {tab === "categories" ? (
        <Card className="p-5 sm:p-6 space-y-5">
          <div>
            <Label htmlFor="business-type">Business type</Label>
            <GlassSelect
              id="business-type"
              disabled={!canManage}
              value={businessType}
              className="mt-1.5"
              onChange={(e) => {
                const next = e.target.value;
                setBusinessType(next);
                setCatalogCategoryIds(defaultCategoryIdsForType(next));
                const type = catalogTypeById(next);
                if (type) {
                  setCategories((prev) =>
                    prev.includes(type.productCategory)
                      ? prev
                      : [...prev, type.productCategory]
                  );
                }
              }}
            >
              <option value="">Select type</option>
              {FINDIT_CATALOG.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline-strong px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Accepting requests</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Turn off to pause new Finds for this store.
              </p>
            </div>
            <IosSwitch
              label="Accepting requests"
              checked={acceptingRequests}
              onCheckedChange={setAcceptingRequests}
              disabled={!canManage}
            />
          </div>

          {catalogTypeById(businessType) ? (
            <div>
              <p className="text-sm font-medium text-ink">Categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {catalogTypeById(businessType)!.categories.map((c) => (
                  <GlassChip
                    key={c.id}
                    disabled={!canManage}
                    selected={catalogCategoryIds.includes(c.id)}
                    onClick={() =>
                      setCatalogCategoryIds((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((id) => id !== c.id)
                          : [...prev, c.id]
                      )
                    }
                    className="disabled:opacity-50"
                  >
                    {c.name}
                  </GlassChip>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="custom-keywords">Extra keywords</Label>
            <Input
              id="custom-keywords"
              disabled={!canManage}
              value={customKeywords}
              onChange={(e) => setCustomKeywords(e.target.value)}
              placeholder="Optional, comma separated"
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline-strong px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Require ID (21+)</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                For tobacco and similar products. Still check ID in store.
              </p>
            </div>
            <IosSwitch
              label="Require ID"
              checked={requiresCustomerId}
              disabled={!canManage}
              onCheckedChange={setRequiresCustomerId}
            />
          </div>

          {canManage ? (
            <Button
              disabled={saving}
              onClick={() => void saveCoverage({ includeCategories: true })}
            >
              {saving ? "Saving…" : "Save requests"}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {tab === "devices" ? (
        <Card className="p-5 sm:p-6">
          <StoreDeviceEnableList
            devices={devices}
            canManage={canManage}
            onChanged={() => {
              void listStoreDevicesAction().then(setDevices);
            }}
          />
          {canManage ? (
            <Link
              href={devicesHref}
              className="mt-4 inline-flex text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
            >
              Pair or rename a device
            </Link>
          ) : null}
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-hairline-strong bg-white">
        <Link
          href={notificationsHref}
          className="flex items-center justify-between gap-3 border-b border-hairline-strong px-4 py-3.5 hover:bg-black/[0.03]"
        >
          <span className="text-sm font-semibold text-ink">Notifications</span>
          <ChevronRight className="h-4 w-4 text-ink-subtle" />
        </Link>
        {canManage ? (
          <Link
            href={billingHref}
            className="flex items-center justify-between gap-3 border-b border-hairline-strong px-4 py-3.5 hover:bg-black/[0.03]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">Billing</span>
              <span className="block text-xs text-ink-muted">{plan.name}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
          </Link>
        ) : null}
        <Link
          href={accountHref}
          className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-black/[0.03]"
        >
          <span className="text-sm font-semibold text-ink">Account</span>
          <ChevronRight className="h-4 w-4 text-ink-subtle" />
        </Link>
      </div>
    </div>
  );
}
