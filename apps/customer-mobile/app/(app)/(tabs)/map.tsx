import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  formatShortPlace,
  mapsDirectionsUrl,
  publicStoreMapRating,
} from "@findit/domain";
import { radius, spacing, typography } from "@findit/theme";
import { useAppTheme } from "@findit/theme/native";
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

const CARD_WIDTH = Math.min(288, Dimensions.get("window").width * 0.8);
const CARD_GAP = 12;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };
const ACCENT = "#B42332";

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

function mapLibreHtml(stores: PublicStoreMapItem[]) {
  const style = {
    version: 8,
    name: "FINDIT",
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto", minzoom: 0, maxzoom: 20 }],
  };
  const payload = JSON.stringify({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
    })),
    accent: ACCENT,
    style,
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#F0ECEE; }
  .maplibregl-ctrl-attrib { font-size: 10px; }
  .findit-store-marker { display:block; padding:0; border:0; background:transparent; cursor:pointer; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const boot = ${payload};
  const map = new maplibregl.Map({
    container: 'map',
    style: boot.style,
    center: [-77.09, 38.82],
    zoom: 11,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  const markers = {};
  function paint(el, selected, name) {
    var size = selected ? 32 : 24;
    el.title = name;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = '<span style="display:block;width:'+size+'px;height:'+size+'px;border-radius:999px 999px 999px 4px;transform:rotate(-45deg);background:'+boot.accent+';border:2.5px solid #fff;box-shadow:0 4px 14px rgba(23,19,21,.35);"><span style="display:block;width:8px;height:8px;margin:'+((size-8)/2)+'px auto 0;border-radius:999px;background:#fff;transform:rotate(45deg);"></span></span>';
  }
  function makeMarker(store, selected) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'findit-store-marker';
    paint(el, selected, store.name);
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: store.id }));
    });
    return new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([store.lng, store.lat])
      .addTo(map);
  }
  function fitAll() {
    if (!boot.stores.length) {
      map.jumpTo({ center: [-77.09, 38.82], zoom: 11 });
      return;
    }
    if (boot.stores.length === 1) {
      map.jumpTo({ center: [boot.stores[0].lng, boot.stores[0].lat], zoom: 14 });
      return;
    }
    var bounds = new maplibregl.LngLatBounds();
    boot.stores.forEach(function(s) { bounds.extend([s.lng, s.lat]); });
    map.fitBounds(bounds, {
      padding: { top: 96, bottom: 220, left: 28, right: 28 },
      maxZoom: 14,
      duration: 0
    });
  }
  map.on('load', function() {
    boot.stores.forEach(function(store) {
      markers[store.id] = makeMarker(store, false);
    });
    fitAll();
    setTimeout(function() { map.resize(); }, 80);
  });
  function applySelection(id) {
    Object.keys(markers).forEach(function(key) {
      var store = boot.stores.find(function(s) { return s.id === key; });
      if (!store) return;
      paint(markers[key].getElement(), key === id, store.name);
    });
    if (id && markers[id]) {
      map.easeTo({ center: markers[id].getLngLat(), duration: 420 });
    }
  }
  function onNativeMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'select') applySelection(msg.id);
    } catch (err) {}
  }
  document.addEventListener('message', function(e) { onNativeMessage(e.data); });
  window.addEventListener('message', function(e) { onNativeMessage(e.data); });
</script>
</body>
</html>`;
}

function CircleButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

function StarRow({ stars }: { stars: number }) {
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return (
    <View
      style={styles.starRow}
      accessibilityLabel={`${stars} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < full || (index === full && half);
        const name =
          index < full
            ? "star"
            : index === full && half
              ? "star-half-full"
              : "star-o";
        return (
          <FontAwesome
            key={index}
            name={name}
            size={16}
            color={filled ? ACCENT : "rgba(0,0,0,0.15)"}
            style={styles.starIcon}
          />
        );
      })}
    </View>
  );
}

export default function StoresMapScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stores, setStores] = useState<PublicStoreMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
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

  const html = useMemo(
    () => mapLibreHtml(stores),
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
    <View style={[styles.fill, { backgroundColor: "#F0ECEE" }]}>
      <View style={styles.mapWrap}>
        {loading && stores.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : (
          <>
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
            {!loading && stores.length === 0 ? (
              <View pointerEvents="none" style={styles.emptyOverlay}>
                <Text style={[styles.empty, { color: theme.inkMuted }]}>
                  {error || "No FINDIT stores nearby yet."}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {stores.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cardDock,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {selected ? (
            <View style={styles.openPillWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${selected.name}`}
                onPress={() => openProfile(selected.id)}
                style={({ pressed }) => [
                  styles.openStorePill,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <FontAwesome name="map-marker" size={16} color={ACCENT} />
                <Text style={styles.openStorePillText}>Open {selected.name}</Text>
              </Pressable>
            </View>
          ) : null}
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
                <View
                  style={[
                    styles.card,
                    {
                      width: CARD_WIDTH,
                      backgroundColor: active ? "#171315" : "rgba(255,255,255,0.96)",
                      borderColor: active ? "#171315" : "rgba(255,255,255,0.8)",
                    },
                  ]}
                >
                  <View style={styles.cardTop}>
                    <Text
                      style={[
                        styles.cardName,
                        { color: active ? "#fff" : theme.ink },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.openPill,
                        {
                          backgroundColor: item.open_now
                            ? active
                              ? ACCENT
                              : "rgba(180,35,50,0.12)"
                            : active
                              ? "rgba(255,255,255,0.14)"
                              : "rgba(0,0,0,0.05)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.openLabel,
                          {
                            color: item.open_now
                              ? active
                                ? "#fff"
                                : "#8E1F2D"
                              : active
                                ? "rgba(255,255,255,0.75)"
                                : theme.inkMuted,
                          },
                        ]}
                      >
                        {item.open_label}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.cardAddr,
                      { color: active ? "rgba(255,255,255,0.7)" : theme.inkMuted },
                    ]}
                    numberOfLines={2}
                  >
                    {formatAddress(item)}
                  </Text>
                  {item.distance_miles != null ? (
                    <Text
                      style={[
                        styles.miles,
                        {
                          color: active ? "rgba(255,255,255,0.55)" : theme.inkSubtle,
                        },
                      ]}
                    >
                      {item.distance_miles} mi away
                    </Text>
                  ) : null}
                </View>
              );
            }}
          />
        </View>
      ) : null}

      {profile && profileRating ? (
        <View style={styles.overlay}>
          <Pressable
            style={styles.overlayScrim}
            accessibilityRole="button"
            accessibilityLabel="Close store profile"
            onPress={() => setProfileId(null)}
          />
          <View style={styles.overlayCenter} pointerEvents="box-none">
            <View
              style={[styles.profileDialog, { backgroundColor: theme.solid1 }]}
            >
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {profile.name}
              </Text>
              <Text style={[styles.sheetAddr, { color: theme.inkMuted }]}>
                {formatAddress(profile)}
              </Text>

              <View
                style={[
                  styles.ratingBox,
                  {
                    borderColor: theme.hairlineStrong,
                    backgroundColor: theme.solid2,
                  },
                ]}
              >
                <Text style={[styles.ratingLabel, { color: theme.inkSubtle }]}>
                  Rating
                </Text>
                <View style={styles.ratingRow}>
                  <StarRow stars={profileRating.stars} />
                  <Text style={[styles.ratingScore, { color: theme.ink }]}>
                    {profileRating.score != null
                      ? profileRating.score.toFixed(1)
                      : "—"}
                  </Text>
                </View>
                <Text style={[styles.ratingCaption, { color: theme.inkMuted }]}>
                  {profileRating.label}
                  {profile.open_now ? " · Open now" : " · Closed"}
                </Text>
              </View>

              <Pressable
                onPress={() => Linking.openURL(mapsDirectionsUrl(profile))}
                style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
              >
                <Text style={styles.primaryBtnText}>Open in Maps</Text>
              </Pressable>
              <Text style={[styles.mapsNote, { color: theme.inkMuted }]}>
                Opens your device's default Maps app for driving directions.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {infoOpen ? (
        <View style={styles.overlay}>
          <Pressable
            style={styles.overlayScrim}
            accessibilityRole="button"
            accessibilityLabel="Close about map"
            onPress={() => setInfoOpen(false)}
          />
          <View style={styles.overlayCenter} pointerEvents="box-none">
            <View
              style={[styles.profileDialog, { backgroundColor: theme.solid1 }]}
            >
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                About this map
              </Text>
              <Text style={[styles.infoLead, { color: theme.inkMuted }]}>
                How FINDIT works, and how we treat your data.
              </Text>
              <Text style={[styles.infoHead, { color: theme.ink }]}>
                How FINDIT works
              </Text>
              <Text style={[styles.infoBody, { color: theme.inkMuted }]}>
                You ask nearby stores if they have a product. Stores answer In Stock,
                Out of Stock, or Can Order. You choose where to go. FINDIT is not a
                checkout cart — it connects you with local stores that participate.
              </Text>
              <Text style={[styles.infoHead, { color: theme.ink }]}>Your privacy</Text>
              <Text style={[styles.infoBody, { color: theme.inkMuted }]}>
                We do not sell your personal data to third-party companies or any other
                companies. Location on this map is used to show FINDIT stores near you
                and to sort them nearest first.
              </Text>
              <Text style={[styles.infoHead, { color: theme.ink }]}>This map</Text>
              <Text style={[styles.infoBody, { color: theme.inkMuted }]}>
                Swipe the cards to browse stores. Tap a pin, or the Open button above
                the cards, for rating and directions in your device Maps app.
              </Text>
              <Pressable
                onPress={() => setInfoOpen(false)}
                style={[styles.primaryBtn, { backgroundColor: "#171315", marginTop: 18 }]}
              >
                <Text style={styles.primaryBtnText}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}
      >
        <CircleButton label="Go back" onPress={() => router.replace("/(app)/(tabs)")}>
          <FontAwesome name="arrow-left" size={18} color="#171315" />
        </CircleButton>
        <CircleButton label="About FINDIT map" onPress={() => setInfoOpen(true)}>
          <FontAwesome name="info" size={18} color="#171315" />
        </CircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  mapWrap: { ...StyleSheet.absoluteFill },
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
  emptyOverlay: {
    position: "absolute",
    top: 96,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1100,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#171315",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
    paddingTop: 28,
  },
  openPillWrap: {
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: spacing.lg,
  },
  openStorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#171315",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  openStorePillText: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
    color: "#171315",
  },
  cards: {
    paddingHorizontal: spacing.lg,
    gap: CARD_GAP,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginRight: CARD_GAP,
    shadowColor: "#171315",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: typography.weight.bold,
  },
  openPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  openLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
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
    fontWeight: typography.weight.semibold,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  overlayScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayCenter: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  profileDialog: {
    width: "100%",
    maxWidth: 384,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: spacing.lg,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  starIcon: {
    width: 16,
  },
  ratingBox: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  ratingRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  ratingScore: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.bold,
    fontVariant: ["tabular-nums"],
  },
  ratingCaption: {
    marginTop: 6,
    fontSize: typography.size.caption,
    lineHeight: 16,
  },
  mapsNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: typography.size.caption,
    lineHeight: 16,
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
  primaryBtn: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  infoLead: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: typography.size.footnote,
    lineHeight: 20,
  },
  infoHead: {
    marginTop: 14,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  infoBody: {
    marginTop: 6,
    fontSize: typography.size.footnote,
    lineHeight: 20,
  },
});
