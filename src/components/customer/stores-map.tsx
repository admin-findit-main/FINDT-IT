"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import { formatShortPlace, mapsDirectionsAnchorProps } from "@findit/domain";
import { GlassSheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";
import { geolocateUsPlace } from "@/lib/customer/geolocate";

const StoresMapLeaflet = dynamic(
  () =>
    import("@/components/customer/stores-map-leaflet").then(
      (mod) => mod.StoresMapLeaflet
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[16rem] place-items-center bg-[var(--fd-ink-50)] text-sm text-ink-muted">
        Loading map…
      </div>
    ),
  }
);

function formatAddress(store: PublicStoreMapItem) {
  const line = store.street_address.trim();
  const place = formatShortPlace({
    city: store.city,
    state: store.state,
    postalCode: store.postal_code,
  });
  if (line && place) return `${line}, ${place}`;
  return line || place || "Location unavailable";
}

export function StoresMap() {
  const [stores, setStores] = useState<PublicStoreMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const load = useCallback(async (coords?: { lat: number; lng: number } | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      }
      const qs = params.toString();
      const response = await fetch(
        `/api/customer/stores-map${qs ? `?${qs}` : ""}`
      );
      if (!response.ok) throw new Error("load-failed");
      const body = (await response.json()) as { stores?: PublicStoreMapItem[] };
      const next = body.stores || [];
      setStores(next);
      setSelectedId((prev) => {
        if (prev && next.some((s) => s.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    } catch {
      setError("Couldn’t load stores. Try again.");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const geo = await geolocateUsPlace();
      if (cancelled) return;
      if (geo.ok) {
        setUserCoords(geo.coords);
        await load(geo.coords);
      } else {
        await load(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selected = useMemo(
    () => stores.find((s) => s.id === selectedId) || null,
    [stores, selectedId]
  );
  const profile = useMemo(
    () => stores.find((s) => s.id === profileId) || null,
    [stores, profileId]
  );

  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current.get(selectedId);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedId]);

  function selectStore(id: string, openProfile = false) {
    setSelectedId(id);
    if (openProfile) setProfileId(id);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[18rem] flex-1 overflow-hidden border-y border-hairline-strong bg-[var(--fd-ink-50)] sm:min-h-[22rem]">
        {loading && stores.length === 0 ? (
          <div className="grid h-full min-h-[16rem] place-items-center text-sm text-ink-muted">
            Finding stores…
          </div>
        ) : stores.length === 0 ? (
          <div className="grid h-full min-h-[16rem] place-items-center px-6 text-center text-sm text-ink-muted">
            {error || "No FINDIT stores with a map location yet."}
          </div>
        ) : (
          <StoresMapLeaflet
            stores={stores}
            selectedId={selectedId}
            userCoords={userCoords}
            onSelect={(id) => selectStore(id, true)}
          />
        )}
      </div>

      {stores.length > 0 ? (
        <div
          ref={stripRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 py-4 sm:px-8"
          style={{ scrollbarWidth: "none" }}
        >
          {stores.map((store) => {
            const active = store.id === selectedId;
            return (
              <button
                key={store.id}
                type="button"
                ref={(node) => {
                  if (node) cardRefs.current.set(store.id, node);
                  else cardRefs.current.delete(store.id);
                }}
                onClick={() => selectStore(store.id, true)}
                className={cn(
                  "w-[min(17.5rem,78vw)] shrink-0 snap-center rounded-2xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-hairline-strong bg-white hover:bg-black/[0.02]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold tracking-tight text-ink">
                    {store.name}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                      store.open_now ? "text-accent-ink" : "text-ink-muted"
                    )}
                  >
                    {store.open_label}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-ink-muted">
                  {formatAddress(store)}
                </p>
                {store.distance_miles != null ? (
                  <p className="mt-2 text-[11px] font-medium text-ink-subtle">
                    {store.distance_miles} mi
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <GlassSheet
        open={Boolean(profile)}
        onOpenChange={(open) => {
          if (!open) setProfileId(null);
        }}
        title={profile?.name || "Store"}
        description={profile ? formatAddress(profile) : undefined}
      >
        {profile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-accent" strokeWidth={2.2} />
              <span
                className={cn(
                  "font-semibold",
                  profile.open_now ? "text-accent-ink" : "text-ink-muted"
                )}
              >
                {profile.open_label}
              </span>
            </div>
            {profile.hours_label ? (
              <p className="text-sm leading-relaxed text-ink-muted">
                {profile.hours_label}
              </p>
            ) : null}
            {profile.phone ? (
              <a
                href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-2"
              >
                <Phone className="h-4 w-4" strokeWidth={2.2} />
                {profile.phone}
              </a>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1" size="lg">
                <a {...mapsDirectionsAnchorProps(profile)}>
                  Get directions
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link href={`/shops/${profile.slug}`}>View store</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </GlassSheet>

      {selected && !profile ? (
        <span className="sr-only">Selected {selected.name}</span>
      ) : null}
    </div>
  );
}
