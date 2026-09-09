"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";

const ACCENT = "#B42332";

function storeIcon(selected: boolean) {
  const size = selected ? 32 : 24;
  return L.divIcon({
    className: "findit-store-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<span style="
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
    "></span></span>`,
  });
}

const userIcon = L.divIcon({
  className: "findit-user-marker",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<span style="
    display:block;
    width:18px;
    height:18px;
    border-radius:999px;
    background:#171315;
    border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(23,19,21,.16), 0 2px 8px rgba(0,0,0,.28);
  "></span>`,
});

export function StoresMapLeaflet({
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
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);

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
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · CARTO',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    const resize = () => {
      map.invalidateSize({ animate: false });
    };
    window.setTimeout(resize, 60);
    window.addEventListener("resize", resize);

    const markers = markersRef.current;
    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      markers.clear();
      userMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [id, marker] of markersRef.current) {
      if (!stores.some((s) => s.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const latLngs: L.LatLngExpression[] = [];
    for (const store of stores) {
      const latLng: L.LatLngExpression = [store.latitude, store.longitude];
      latLngs.push(latLng);
      let marker = markersRef.current.get(store.id);
      if (!marker) {
        marker = L.marker(latLng, {
          icon: storeIcon(store.id === selectedId),
          title: store.name,
        }).addTo(map);
        marker.on("click", () => onSelectRef.current(store.id));
        markersRef.current.set(store.id, marker);
      } else {
        marker.setLatLng(latLng);
      }
    }

    if (userCoords) {
      const userLatLng: L.LatLngExpression = [userCoords.lat, userCoords.lng];
      latLngs.push(userLatLng);
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, {
          icon: userIcon,
          title: "You",
          interactive: false,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }
    }

    map.invalidateSize({ animate: false });
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 14);
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), {
        paddingTopLeft: [28, 88],
        paddingBottomRight: [28, Math.max(bottomPad, 120)],
        maxZoom: 14,
      });
    }
    // Only refit when the store set / user coords change, not on selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, bottomPad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const store of stores) {
      const marker = markersRef.current.get(store.id);
      if (!marker) continue;
      marker.setIcon(storeIcon(store.id === selectedId));
    }
    const selected = stores.find((s) => s.id === selectedId);
    if (selected) {
      map.panTo([selected.latitude, selected.longitude], { animate: true });
    }
  }, [selectedId, stores]);

  return <div ref={containerRef} className="h-full w-full" />;
}
