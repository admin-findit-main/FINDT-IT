"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Info,
  MapPin,
  Phone,
} from "lucide-react";
import { formatShortPlace, mapsDirectionsAnchorProps } from "@findit/domain";
import { GlassSheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";
import { geolocateUsPlace } from "@/lib/customer/geolocate";
import { usePublicHref } from "@/components/host/host-surface";

const StoresMapLeaflet = dynamic(
  () =>
    import("@/components/customer/stores-map-leaflet").then(
      (mod) => mod.StoresMapLeaflet
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-[#F0ECEE] text-sm text-ink-muted">
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

function CircleMapButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full border border-black/8 bg-white text-[#171315] shadow-[0_8px_24px_rgba(23,19,21,0.18)] transition active:scale-[0.96]",
        className
      )}
    >
      {children}
    </button>
  );
}

export function StoresMap() {
  const router = useRouter();
  const homeHref = usePublicHref("/home");
  const [stores, setStores] = useState<PublicStoreMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
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
    <div className="relative h-dvh w-full overflow-hidden bg-[#F0ECEE]">
      <div className="absolute inset-0">
        {loading && stores.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-muted">
            Finding stores…
          </div>
        ) : stores.length === 0 ? (
          <div className="grid h-full place-items-center px-8 text-center text-sm text-ink-muted">
            {error || "No FINDIT stores with a map location yet."}
          </div>
        ) : (
          <StoresMapLeaflet
            stores={stores}
            selectedId={selectedId}
            userCoords={userCoords}
            onSelect={(id) => selectStore(id, true)}
            bottomPad={220}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          <CircleMapButton label="Go back" onClick={() => router.push(homeHref)}>
            <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
          </CircleMapButton>
        </div>
        <div className="pointer-events-auto">
          <CircleMapButton label="About FINDIT map" onClick={() => setInfoOpen(true)}>
            <Info className="h-5 w-5" strokeWidth={2.4} />
          </CircleMapButton>
        </div>
      </div>

      {stores.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] bg-gradient-to-t from-black/25 via-black/10 to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
          <div
            className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-5"
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
                    "w-[min(18rem,82vw)] shrink-0 snap-center rounded-2xl border px-4 py-3.5 text-left shadow-[0_12px_32px_rgba(23,19,21,0.18)] transition",
                    active
                      ? "border-transparent bg-[#171315] text-white"
                      : "border-white/70 bg-white/95 text-ink backdrop-blur-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[15px] font-bold tracking-tight">
                      {store.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        store.open_now
                          ? active
                            ? "bg-[#B42332] text-white"
                            : "bg-[#B42332]/12 text-[#8E1F2D]"
                          : active
                            ? "bg-white/15 text-white/75"
                            : "bg-black/[0.05] text-ink-muted"
                      )}
                    >
                      {store.open_label}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 line-clamp-2 text-[12px] leading-4",
                      active ? "text-white/70" : "text-ink-muted"
                    )}
                  >
                    {formatAddress(store)}
                  </p>
                  {store.distance_miles != null ? (
                    <p
                      className={cn(
                        "mt-2 text-[11px] font-semibold",
                        active ? "text-white/55" : "text-ink-subtle"
                      )}
                    >
                      {store.distance_miles} mi away
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
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
              <MapPin className="h-4 w-4 text-[#B42332]" strokeWidth={2.2} />
              <span
                className={cn(
                  "font-semibold",
                  profile.open_now ? "text-[#8E1F2D]" : "text-ink-muted"
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

      <GlassSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="About this map"
        description="How FINDIT works, and how we treat your data."
      >
        <div className="space-y-5 text-sm leading-relaxed text-ink">
          <section>
            <h3 className="font-bold tracking-tight text-ink">How FINDIT works</h3>
            <p className="mt-1.5 text-ink-muted">
              You ask nearby stores if they have a product. Stores answer In Stock,
              Out of Stock, or Can Order. You choose where to go. FINDIT is not a
              checkout cart — it connects you with local stores that participate.
            </p>
          </section>
          <section>
            <h3 className="font-bold tracking-tight text-ink">Your privacy</h3>
            <p className="mt-1.5 text-ink-muted">
              We do not sell your personal data to third-party companies or any
              other companies. Location on this map is used to show FINDIT stores
              near you and to sort them nearest first.
            </p>
          </section>
          <section>
            <h3 className="font-bold tracking-tight text-ink">This map</h3>
            <p className="mt-1.5 text-ink-muted">
              Pins are active FINDIT stores with a verified map location. Swipe the
              cards below to browse, or tap a pin for hours and directions.
            </p>
          </section>
          <Link
            href="/privacy"
            className="inline-flex text-sm font-semibold text-[#8E1F2D] underline underline-offset-2"
            onClick={() => setInfoOpen(false)}
          >
            Read the Privacy Policy
          </Link>
        </div>
      </GlassSheet>

      {selected && !profile ? (
        <span className="sr-only">Selected {selected.name}</span>
      ) : null}
    </div>
  );
}
