"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Info,
  MapPinned,
  Navigation,
  Star,
} from "lucide-react";
import {
  formatShortPlace,
  mapsDirectionsAnchorProps,
  publicStoreMapRating,
} from "@findit/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";
import { geolocateUsPlace } from "@/lib/customer/geolocate";
import { usePublicHref } from "@/components/host/host-surface";

const StoresMapGl = dynamic(
  () =>
    import("@/components/customer/stores-map-gl").then((mod) => mod.StoresMapGl),
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

function StarRow({ stars }: { stars: number }) {
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${stars} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < full || (index === full && half);
        return (
          <Star
            key={index}
            className={cn(
              "h-4 w-4",
              filled ? "fill-[#B42332] text-[#B42332]" : "text-black/15"
            )}
            strokeWidth={2}
          />
        );
      })}
    </div>
  );
}

function CircleMapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-black/8 bg-white text-[#171315] shadow-[0_8px_24px_rgba(23,19,21,0.18)] transition active:scale-[0.96]"
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
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollSelectLock = useRef(false);

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
  const profileRating = useMemo(
    () => (profile ? publicStoreMapRating(profile) : null),
    [profile]
  );

  useEffect(() => {
    if (!selectedId || scrollSelectLock.current) return;
    const el = cardRefs.current.get(selectedId);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedId]);

  function syncSelectionFromScroll() {
    const strip = stripRef.current;
    if (!strip) return;
    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let bestId: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const store of stores) {
      const el = cardRefs.current.get(store.id);
      if (!el) continue;
      const center = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = store.id;
      }
    }
    if (bestId && bestId !== selectedId) {
      scrollSelectLock.current = true;
      setSelectedId(bestId);
      window.setTimeout(() => {
        scrollSelectLock.current = false;
      }, 280);
    }
  }

  function openProfile(id: string) {
    setSelectedId(id);
    setProfileId(id);
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
          <StoresMapGl
            stores={stores}
            selectedId={selectedId}
            userCoords={userCoords}
            onSelect={openProfile}
            bottomPad={220}
          />
        )}
      </div>

      {/* Always above map, cards, and modals */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
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
          {selected ? (
            <div className="pointer-events-auto mb-3 flex justify-center px-5">
              <button
                type="button"
                onClick={() => openProfile(selected.id)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/70 bg-white/95 px-4 text-sm font-semibold text-ink shadow-[0_8px_20px_rgba(23,19,21,0.16)] backdrop-blur-md"
              >
                <MapPinned className="h-4 w-4 text-[#B42332]" strokeWidth={2.2} />
                Open {selected.name}
              </button>
            </div>
          ) : null}
          <div
            ref={stripRef}
            onScroll={syncSelectionFromScroll}
            className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-5"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            aria-label="FINDIT stores"
          >
            {stores.map((store) => {
              const active = store.id === selectedId;
              return (
                <div
                  key={store.id}
                  ref={(node) => {
                    if (node) cardRefs.current.set(store.id, node);
                    else cardRefs.current.delete(store.id);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-[min(18rem,82vw)] shrink-0 snap-center select-none rounded-2xl border px-4 py-3.5 shadow-[0_12px_32px_rgba(23,19,21,0.18)]",
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
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(profile)}
        onOpenChange={(open) => {
          if (!open) setProfileId(null);
        }}
      >
        <DialogContent className="z-[1000] max-w-sm rounded-[1.5rem] p-6 pt-7">
          {profile && profileRating ? (
            <>
              <DialogTitle className="pr-10 text-xl font-bold tracking-tight">
                {profile.name}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed">
                {formatAddress(profile)}
              </DialogDescription>

              <div className="mt-5 rounded-2xl border border-hairline-strong bg-[var(--solid-chrome)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                  Rating
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <StarRow stars={profileRating.stars} />
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {profileRating.score != null
                      ? profileRating.score.toFixed(1)
                      : "—"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-4 text-ink-muted">
                  {profileRating.label}
                  {profile.open_now ? " · Open now" : " · Closed"}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button asChild size="lg" className="w-full">
                  <a {...mapsDirectionsAnchorProps(profile)}>
                    <Navigation className="h-4 w-4" strokeWidth={2.2} />
                    Open in Maps
                  </a>
                </Button>
                <p className="text-center text-xs text-ink-muted">
                  Opens your device’s default Maps app for driving directions.
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="z-[1000] max-w-sm rounded-[1.5rem]">
          <DialogTitle>About this map</DialogTitle>
          <DialogDescription>
            How FINDIT works, and how we treat your data.
          </DialogDescription>
          <div className="mt-5 space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-bold text-ink">How FINDIT works</h3>
              <p className="mt-1.5 text-ink-muted">
                You ask nearby stores if they have a product. Stores answer In Stock,
                Out of Stock, or Can Order. You choose where to go. FINDIT is not a
                checkout cart — it connects you with local stores that participate.
              </p>
            </section>
            <section>
              <h3 className="font-bold text-ink">Your privacy</h3>
              <p className="mt-1.5 text-ink-muted">
                We do not sell your personal data to third-party companies or any
                other companies. Location on this map is used to show FINDIT stores
                near you and to sort them nearest first.
              </p>
            </section>
            <section>
              <h3 className="font-bold text-ink">This map</h3>
              <p className="mt-1.5 text-ink-muted">
                Swipe the cards to browse stores. Tap a pin, or the Open button above
                the cards, for rating and directions in your device Maps app.
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
