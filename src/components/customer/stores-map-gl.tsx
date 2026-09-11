"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";
import { FINDIT_MAP_STYLE } from "@/lib/maps/basemap-style";

const ACCENT = "#B42332";

function paintStoreMarker(el: HTMLElement, selected: boolean, name: string) {
  const size = selected ? 32 : 24;
  el.title = name;
  el.setAttribute("aria-label", name);
  el.style.cssText = `
    display:block;width:${size}px;height:${size}px;padding:0;border:0;
    background:transparent;cursor:pointer;appearance:none;
  `;
  el.innerHTML = `<span style="
      display:block;
      width:${size}px;
      height:${size}px;
      border-radius:999px 999px 999px 4px;
      transform:rotate(-45deg);
      background:${ACCENT};
      border:2.5px solid #fff;
      box-shadow:0 4px 14px rgba(23,19,21,.35);
      ${selected ? "outline:3px solid rgba(180,35,50,.28);outline-offset:2px;" : ""}
    "><span style="
      display:block;
      width:8px;
      height:8px;
      margin:${(size - 8) / 2}px auto 0;
      border-radius:999px;
      background:#fff;
      transform:rotate(45deg);
    "></span></span>`;
}

function createStoreMarkerElement(
  storeId: string,
  selected: boolean,
  name: string,
  onSelect: (id: string) => void
) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "findit-store-marker";
  paintStoreMarker(el, selected, name);
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(storeId);
  });
  return el;
}

function createUserMarkerElement() {
  const el = document.createElement("div");
  el.className = "findit-user-marker";
  el.style.cssText = "width:18px;height:18px;";
  el.innerHTML = `<span style="
    display:block;
    width:18px;
    height:18px;
    border-radius:999px;
    background:#171315;
    border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(23,19,21,.16), 0 2px 8px rgba(0,0,0,.28);
  "></span>`;
  return el;
}

export function StoresMapGl({
  stores,
  selectedId,
  userCoords,
  onSelect,
  bottomPad = 180,
}: {
  stores: PublicStoreMapItem[];
  selectedId: string | null;
  userCoords: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  bottomPad?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const boundsKey = useMemo(
    () =>
      stores.map((s) => `${s.id}:${s.latitude},${s.longitude}`).join("|") +
      (userCoords ? `|u:${userCoords.lat},${userCoords.lng}` : ""),
    [stores, userCoords]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    const map = new MapLibreMap({
      container,
      style: FINDIT_MAP_STYLE,
      center: userCoords
        ? [userCoords.lng, userCoords.lat]
        : [-77.09, 38.82],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-right"
    );
    mapRef.current = map;

    const onLoad = () => {
      mapReadyRef.current = true;
      map.resize();
    };
    map.on("load", onLoad);

    const resize = () => map.resize();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    ro?.observe(container);
    window.setTimeout(resize, 60);
    window.setTimeout(resize, 300);
    window.addEventListener("resize", resize);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      map.off("load", onLoad);
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; coords applied in sync effect
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncMarkers = () => {
      for (const [id, marker] of markersRef.current) {
        if (!stores.some((s) => s.id === id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }

      const bounds = new LngLatBounds();
      let pointCount = 0;

      for (const store of stores) {
        const lngLat: [number, number] = [store.longitude, store.latitude];
        bounds.extend(lngLat);
        pointCount += 1;
        let marker = markersRef.current.get(store.id);
        if (!marker) {
          const el = createStoreMarkerElement(
            store.id,
            store.id === selectedId,
            store.name,
            (id) => onSelectRef.current(id)
          );
          const newMarker = new Marker({ element: el, anchor: "bottom" })
            .setLngLat(lngLat)
            .addTo(map);
          markersRef.current.set(store.id, newMarker);
          marker = newMarker;
        } else {
          marker.setLngLat(lngLat);
          paintStoreMarker(
            marker.getElement(),
            store.id === selectedId,
            store.name
          );
        }
      }

      if (userCoords) {
        const lngLat: [number, number] = [userCoords.lng, userCoords.lat];
        bounds.extend(lngLat);
        pointCount += 1;
        if (!userMarkerRef.current) {
          userMarkerRef.current = new Marker({
            element: createUserMarkerElement(),
            anchor: "center",
          })
            .setLngLat(lngLat)
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat(lngLat);
        }
      }

      map.resize();
      if (pointCount === 0) return;
      if (pointCount === 1) {
        const only = userCoords
          ? ([userCoords.lng, userCoords.lat] as [number, number])
          : ([stores[0]!.longitude, stores[0]!.latitude] as [number, number]);
        map.jumpTo({ center: only, zoom: 14 });
      } else {
        map.fitBounds(bounds, {
          padding: {
            top: 88,
            bottom: Math.max(bottomPad, 120),
            left: 28,
            right: 28,
          },
          maxZoom: 14,
          duration: 0,
        });
      }
    };

    if (mapReadyRef.current || map.isStyleLoaded()) {
      syncMarkers();
    } else {
      map.once("load", syncMarkers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, bottomPad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const store of stores) {
      const marker = markersRef.current.get(store.id);
      if (!marker) continue;
      paintStoreMarker(
        marker.getElement(),
        store.id === selectedId,
        store.name
      );
    }
    const selected = stores.find((s) => s.id === selectedId);
    if (selected) {
      map.easeTo({
        center: [selected.longitude, selected.latitude],
        duration: 420,
      });
    }
  }, [selectedId, stores]);

  return <div ref={containerRef} className="h-full w-full min-h-[16rem]" />;
}
