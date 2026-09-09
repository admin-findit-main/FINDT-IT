"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicStoreMapItem } from "@/lib/services/stores-map";

const ACCENT = "#E5231B";

function storeIcon(selected: boolean) {
  const size = selected ? 28 : 22;
  return L.divIcon({
    className: "findit-store-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${ACCENT};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);${
      selected ? "outline:3px solid rgba(229,35,27,.35);" : ""
    }"></span>`,
  });
}

const userIcon = L.divIcon({
  className: "findit-user-marker",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:#0B0B0C;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
});

export function StoresMapLeaflet({
  stores,
  selectedId,
  userCoords,
  onSelect,
}: {
  stores: PublicStoreMapItem[];
  selectedId: string | null;
  userCoords: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
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
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
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

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 13);
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 13 });
    }
    // Only refit when the store set / user coords change, not on selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

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

  return <div ref={containerRef} className="h-full min-h-[16rem] w-full" />;
}
