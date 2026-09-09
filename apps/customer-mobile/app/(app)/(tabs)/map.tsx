import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  formatShortPlace,
  mapsDirectionsUrl,
} from "@findit/domain";
import { radius, spacing, typography } from "@findit/theme";
import { useAppTheme } from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import {
  fetchStoresMap,
  type PublicStoreMapItem,
} from "@/lib/api";
import * as Location from "expo-location";

/** react-native-webview typings lag React 19 Component generics in Expo Go. */
const MapWebView = WebView as unknown as ComponentType<{
  ref?: Ref<WebView>;
  originWhitelist?: string[];
  source: { html: string };
  style?: object;
  onMessage?: (event: WebViewMessageEvent) => void;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
}>;
const CARD_WIDTH = Math.min(280, Dimensions.get("window").width * 0.78);
const CARD_GAP = 12;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

function formatAddress(store: PublicStoreMapItem) {
  const line = (store.street_address || "").trim();
  const place = formatShortPlace({
    city: store.city,
    state: store.state,
    postalCode: store.postal_code,
  });
  if (line && place) return `${line}, ${place}`;
  return line || place || "Location unavailable";
}

function leafletHtml(stores: PublicStoreMapItem[], selectedId: string | null) {
  const payload = JSON.stringify({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
    })),
    selectedId,
    accent: "#E5231B",
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#F7F7F8; }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const boot = ${payload};
  const map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO',
    maxZoom: 19
  }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const markers = {};
  function icon(selected) {
    const size = selected ? 28 : 22;
    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      html: '<span style="display:block;width:'+size+'px;height:'+size+'px;border-radius:999px;background:'+boot.accent+';border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></span>'
    });
  }
  const latLngs = [];
  boot.stores.forEach(function(store) {
    const ll = [store.lat, store.lng];
    latLngs.push(ll);
    const m = L.marker(ll, { icon: icon(store.id === boot.selectedId), title: store.name }).addTo(map);
    m.on('click', function() {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: store.id }));
    });
    markers[store.id] = m;
  });
  if (latLngs.length === 1) map.setView(latLngs[0], 13);
  else if (latLngs.length > 1) map.fitBounds(latLngs, { padding: [36, 36], maxZoom: 13 });
  function applySelection(id) {
    Object.keys(markers).forEach(function(key) {
      markers[key].setIcon(icon(key === id));
    });
    if (id && markers[id]) {
      map.panTo(markers[id].getLatLng(), { animate: true });
    }
  }
  document.addEventListener('message', function(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'select') applySelection(msg.id);
    } catch (err) {}
  });
  window.addEventListener('message', function(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'select') applySelection(msg.id);
    } catch (err) {}
  });
</script>
</body>
</html>`;
}

export default function StoresMapScreen() {
  const theme = useAppTheme();
  const [stores, setStores] = useState<PublicStoreMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const listRef = useRef<FlatList<PublicStoreMapItem>>(null);
  const webRef = useRef<WebView>(null);
  const suppressScrollSelect = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).catch(async () => {
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 60_000,
            requiredAccuracy: 2_000,
          });
          if (!last) throw new Error("no-location");
          return last;
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      const next = await fetchStoresMap(lat, lng);
      setStores(next);
      setSelectedId(next[0]?.id ?? null);
    } catch {
      setError("Couldn’t load stores.");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIndex = useMemo(
    () => stores.findIndex((s) => s.id === selectedId),
    [stores, selectedId]
  );
  const profile = useMemo(
    () => stores.find((s) => s.id === profileId) || null,
    [stores, profileId]
  );

  const html = useMemo(
    () => leafletHtml(stores, selectedId),
    // Re-bootstrap only when the store set changes; selection is injected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stores]
  );

  useEffect(() => {
    if (!selectedId) return;
    webRef.current?.postMessage(JSON.stringify({ type: "select", id: selectedId }));
    if (selectedIndex >= 0 && !suppressScrollSelect.current) {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
    suppressScrollSelect.current = false;
  }, [selectedId, selectedIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as PublicStoreMapItem | undefined;
      if (!first) return;
      suppressScrollSelect.current = true;
      setSelectedId(first.id);
    },
    []
  );

  function openProfile(id: string) {
    setSelectedId(id);
    setProfileId(id);
  }

  return (
    <AppChrome title="Stores">
      <View style={styles.fill}>
        <View style={[styles.mapWrap, { backgroundColor: theme.solid2 }]}>
          {loading && stores.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : stores.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.empty, { color: theme.inkMuted }]}>
                {error || "No FINDIT stores with a map location yet."}
              </Text>
            </View>
          ) : (
            <MapWebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html }}
              style={styles.map}
              onMessage={(event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data) as {
                    type?: string;
                    id?: string;
                  };
                  if (msg.type === "select" && msg.id) openProfile(msg.id);
                } catch {
                  /* ignore */
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          )}
        </View>

        {stores.length > 0 ? (
          <FlatList
            ref={listRef}
            horizontal
            data={stores}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_GAP,
              offset: (CARD_WIDTH + CARD_GAP) * index,
              index,
            })}
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => openProfile(item.id)}
                  style={[
                    styles.card,
                    {
                      width: CARD_WIDTH,
                      backgroundColor: active ? theme.accentSoft : theme.solid1,
                      borderColor: active ? theme.accent : theme.hairlineStrong,
                    },
                  ]}
                >
                  <View style={styles.cardTop}>
                    <Text
                      style={[styles.cardName, { color: theme.ink }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.openLabel,
                        { color: item.open_now ? theme.accentInk : theme.inkMuted },
                      ]}
                    >
                      {item.open_label}
                    </Text>
                  </View>
                  <Text
                    style={[styles.cardAddr, { color: theme.inkMuted }]}
                    numberOfLines={2}
                  >
                    {formatAddress(item)}
                  </Text>
                  {item.distance_miles != null ? (
                    <Text style={[styles.miles, { color: theme.inkSubtle }]}>
                      {item.distance_miles} mi
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>

      <Modal
        visible={Boolean(profile)}
        animationType="slide"
        transparent
        onRequestClose={() => setProfileId(null)}
      >
        <Pressable style={styles.sheetScrim} onPress={() => setProfileId(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.solid1 }]}>
          {profile ? (
            <>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {profile.name}
              </Text>
              <Text style={[styles.sheetAddr, { color: theme.inkMuted }]}>
                {formatAddress(profile)}
              </Text>
              <Text
                style={[
                  styles.sheetOpen,
                  { color: profile.open_now ? theme.accentInk : theme.inkMuted },
                ]}
              >
                {profile.open_label}
              </Text>
              {profile.hours_label ? (
                <Text style={[styles.sheetHours, { color: theme.inkMuted }]}>
                  {profile.hours_label}
                </Text>
              ) : null}
              {profile.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${profile.phone}`)}>
                  <Text style={[styles.sheetPhone, { color: theme.ink }]}>
                    {profile.phone}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => Linking.openURL(mapsDirectionsUrl(profile))}
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.inkInverse }]}>
                  Get directions
                </Text>
              </Pressable>
              <Pressable onPress={() => setProfileId(null)} style={styles.closeBtn}>
                <Text style={{ color: theme.inkMuted, fontWeight: "600" }}>Close</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  mapWrap: { flex: 1, minHeight: 240 },
  map: { flex: 1, backgroundColor: "transparent" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  empty: {
    textAlign: "center",
    fontSize: typography.size.footnote,
  },
  cards: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: CARD_GAP,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginRight: CARD_GAP,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  openLabel: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
  },
  cardAddr: {
    marginTop: 6,
    fontSize: typography.size.caption,
    lineHeight: 16,
  },
  miles: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: typography.weight.medium,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
  },
  sheetAddr: {
    marginTop: 6,
    fontSize: typography.size.footnote,
    lineHeight: 20,
  },
  sheetOpen: {
    marginTop: spacing.md,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  sheetHours: {
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
    lineHeight: 18,
  },
  sheetPhone: {
    marginTop: spacing.md,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    textDecorationLine: "underline",
  },
  primaryBtn: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  closeBtn: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
