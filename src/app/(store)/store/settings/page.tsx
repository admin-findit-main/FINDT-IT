"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { LoadMark } from "@/components/shared/load-progress";
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
import { cn } from "@/lib/utils";
import type { Store } from "@/types/database";

type HourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

type OpenSection = "profile" | "hours" | "area" | "categories" | "plan" | null;

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

function SectionCard({
  title,
  body,
  open,
  onToggle,
  children,
}: {
  title: string;
  body: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>
          <span className="block font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-sm text-ink-muted">{body}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-ink-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-hairline-strong p-5 sm:p-6">
          {children}
        </div>
      ) : null}
    </Card>
  );
}

function MenuLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  const publicHref = usePublicHref(href);
  return (
    <Link href={publicHref}>
      <Card interactive className="flex items-center justify-between gap-4 p-5">
        <span>
          <span className="block font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-sm text-ink-muted">{body}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" />
      </Card>
    </Link>
  );
}

export default function StoreSettingsPage() {
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
  const [loadPercent, setLoadPercent] = useState(8);
  const [ready, setReady] = useState(false);
  const [requiresCustomerId, setRequiresCustomerId] = useState(false);
  const [openSection, setOpenSection] = useState<OpenSection>(null);

  const canManage = role === "owner" || role === "manager";

  useEffect(() => {
    function applyHash() {
      const id = window.location.hash.replace("#", "");
      if (
        id === "profile" ||
        id === "hours" ||
        id === "area" ||
        id === "categories" ||
        id === "plan"
      ) {
        setOpenSection(id);
      }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadPercent(18);
    getMyStoreSettingsAction()
      .then((settings) => {
        if (cancelled) return;
        setLoadPercent(82);
        if (!settings) {
          setReady(true);
          setLoadPercent(100);
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
        setLoadPercent(100);
        setReady(true);
      })
      .catch((err) => {
        console.error("[FINDIT] store settings load failed", err);
        if (!cancelled) {
          setReady(true);
          setLoadPercent(100);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSection(id: Exclude<OpenSection, null>) {
    setOpenSection((cur) => {
      const next = cur === id ? null : id;
      const path = window.location.pathname;
      window.history.replaceState(null, "", next ? `${path}#${next}` : path);
      return next;
    });
  }

  function patchHour(idx: number, patch: Partial<HourRow>) {
    setHours((prev) =>
      normalizeHours(prev).map((row) =>
        row.day_of_week === idx ? { ...row, ...patch } : row
      )
    );
  }

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

  const plan =
    STORE_PLANS[(store?.subscription_plan as keyof typeof STORE_PLANS) || "free"];

  if (!ready) {
    return <LoadMark percent={loadPercent} label="Loading store profile" />;
  }

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

      <div className="mt-6 space-y-3">
        <SectionCard
          title="Business Profile"
          body="Name, address, phone, website"
          open={openSection === "profile"}
          onToggle={() => toggleSection("profile")}
        >
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
                  name="store-name"
                  autoComplete="off"
                  value={name}
                  disabled={!canManage}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="store-description">Description</Label>
                <Input
                  id="store-description"
                  name="store-description"
                  autoComplete="off"
                  value={description}
                  disabled={!canManage}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  name="store-phone"
                  type="tel"
                  autoComplete="off"
                  value={phone}
                  disabled={!canManage}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="store-website">Website</Label>
                <Input
                  id="store-website"
                  name="store-website"
                  autoComplete="off"
                  value={website}
                  disabled={!canManage}
                  onChange={(e) => setWebsite(e.target.value)}
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
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-ink-muted">Verified</span>
              {store?.is_verified ? (
                <VerifiedStoreBadge label="Verified FINDIT store" />
              ) : (
                <span className="text-ink">Pending FINDIT review</span>
              )}
            </div>
            {canManage ? (
              <Button type="submit" disabled={saving}>
                Save profile
              </Button>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          title="Business Hours"
          body="Open days and open–close times"
          open={openSection === "hours"}
          onToggle={() => toggleSection("hours")}
        >
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day, idx) => {
              const row = hours[idx] || normalizeHours([])[idx];
              const openValue = toHm(row.open_time, "09:00");
              const closeValue = toHm(row.close_time, "21:00");
              return (
                <div
                  key={day}
                  className="rounded-glass-md bg-glass-1 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{day}</p>
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
                        <Label htmlFor={`hours-open-${idx}`}>Open</Label>
                        <GlassSelect
                          id={`hours-open-${idx}`}
                          name={`hours-open-${idx}`}
                          autoComplete="off"
                          disabled={!canManage}
                          value={openValue}
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
                        <Label htmlFor={`hours-close-${idx}`}>Close</Label>
                        <GlassSelect
                          id={`hours-close-${idx}`}
                          name={`hours-close-${idx}`}
                          autoComplete="off"
                          disabled={!canManage}
                          value={closeValue}
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
              onClick={() => void saveCoverage()}
            >
              {saving ? "Saving…" : "Save hours"}
            </Button>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Service Area"
          body="ZIP codes and radius you serve"
          open={openSection === "area"}
          onToggle={() => toggleSection("area")}
        >
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
          <div className="mt-4">
            <Label htmlFor="store-zips">Service ZIP codes</Label>
            <Input
              id="store-zips"
              name="store-zips"
              autoComplete="off"
              disabled={!canManage}
              value={serviceZips}
              onChange={(e) => setServiceZips(e.target.value)}
              placeholder="22044, 22042, 22046"
            />
          </div>
          {canManage ? (
            <Button
              className="mt-4"
              disabled={saving}
              onClick={() => void saveCoverage()}
            >
              {saving ? "Saving…" : "Save service area"}
            </Button>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Request Categories"
          body="What requests you receive"
          open={openSection === "categories"}
          onToggle={() => toggleSection("categories")}
        >
          <p className="text-sm text-ink-muted">
            Pick your business type, then the categories you want FINDIT requests
            for. Keywords are predefined — add a custom tag only for unusual
            brands.
          </p>
          <div className="mt-4">
            <Label htmlFor="business-type">Business type</Label>
            <GlassSelect
              id="business-type"
              name="store-business-type"
              autoComplete="off"
              disabled={!canManage}
              value={businessType}
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
          <div className="mt-4 flex items-center justify-between gap-3 rounded-glass-md bg-glass-1 px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Accepting FINDIT requests</p>
              <p className="mt-1 text-xs text-ink-muted">
                Off means nearby Finds will not be sent to this store.
              </p>
            </div>
            <IosSwitch
              label="Accepting FINDIT requests"
              checked={acceptingRequests}
              onCheckedChange={setAcceptingRequests}
              disabled={!canManage}
            />
          </div>
          {catalogTypeById(businessType) ? (
            <div className="mt-4">
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
          <div className="mt-4">
            <Label htmlFor="custom-keywords">Custom keywords (optional)</Label>
            <Input
              id="custom-keywords"
              name="store-custom-keywords"
              autoComplete="off"
              disabled={!canManage}
              value={customKeywords}
              onChange={(e) => setCustomKeywords(e.target.value)}
              placeholder="Rare brand, comma separated"
            />
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
          {canManage ? (
            <Button
              className="mt-4"
              disabled={saving}
              onClick={() => void saveCoverage()}
            >
              {saving ? "Saving…" : "Save categories"}
            </Button>
          ) : null}
        </SectionCard>

        {canManage ? (
          <MenuLink
            href="/store/team"
            title="Team"
            body="Invite employees and managers"
          />
        ) : null}

        <MenuLink
          href="/store/notifications"
          title="Notifications"
          body="Allow alerts and see new asks"
        />

        {role === "owner" || role === "manager" ? (
          <MenuLink
            href="/store/subscription"
            title="Billing"
            body={`${plan.name} — ${plan.tagline}`}
          />
        ) : null}

        <MenuLink
          href="/store/account"
          title="Account"
          body="Your login and role for this store"
        />
      </div>
    </div>
  );
}
