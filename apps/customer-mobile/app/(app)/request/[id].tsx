import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import {
  buildAnalyticsEvent,
  formatExpiresIn,
  formatRelativeTime,
  formatShortPlace,
  isRequestExpired,
  mapsDirectionsUrl,
  WAITING_FOR_REPLY_HINT,
} from "@findit/domain";
import { spacing, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassEmptyState,
  StatusPill,
  StatusRail,
  toneForResponse,
  useAppTheme,
} from "@findit/theme/native";
import {
  cancelRequest,
  fetchRequestDetail,
  fulfillRequest,
  saveRequest,
  stillLooking,
  subscribeRequestRealtime,
} from "@/lib/api";
import { Screen } from "@/components/screen";
import { supabase } from "@/lib/supabase";

type Detail = Awaited<ReturnType<typeof fetchRequestDetail>>;

const STORES_PAGE_SIZE = 5;

export default function RequestDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [foundStep, setFoundStep] = useState<"idle" | "ask" | "done">("idle");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [visibleStoreCount, setVisibleStoreCount] = useState(STORES_PAGE_SIZE);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchRequestDetail(id);
    setDetail(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    setVisibleStoreCount(STORES_PAGE_SIZE);
  }, [id]);

  useEffect(() => {
    load();
    if (!id) return;
    const unsub = subscribeRequestRealtime(id, load);
    const poll = setInterval(load, 4000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [id, load]);

  if (loading) {
    return (
      <GlassBackdrop style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </GlassBackdrop>
    );
  }
  if (!detail) {
    return (
      <GlassBackdrop style={styles.centerPadded}>
        <GlassEmptyState title="Request not found" />
      </GlassBackdrop>
    );
  }

  const expired = isRequestExpired(detail.expires_at, detail.status);
  const closed =
    expired || detail.status === "cancelled" || detail.status === "fulfilled";
  const responses = [...(detail.responses || [])].sort((a, b) => {
    const order: Record<string, number> = {
      in_stock: 0,
      can_order: 1,
      out_of_stock: 2,
    };
    return (order[a.response_type] ?? 9) - (order[b.response_type] ?? 9);
  });
  const visibleResponses = responses.slice(0, visibleStoreCount);
  const hiddenStoreCount = Math.max(0, responses.length - visibleStoreCount);

  const run = async (fn: () => Promise<{ error?: string }>, ok: string) => {
    setBusy(true);
    setNotice(null);
    const result = await fn();
    setBusy(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setNotice(ok);
    load();
  };

  const saveAndGoToRequests = async () => {
    if (busy) return;
    setBusy(true);
    const result = await saveRequest(detail.id);
    setBusy(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    router.replace("/(app)/(tabs)/requests");
  };

  return (
    <Screen variant="stack">
      <GlassCard>
        <Text style={[styles.title, { color: theme.ink }]}>{detail.product_name}</Text>
        <Text style={[styles.meta, { color: theme.inkMuted }]}>
          {detail.status === "fulfilled"
            ? "You found it"
            : expired
              ? "Expired"
              : detail.status.replace(/_/g, " ")}{" "}
          · {formatExpiresIn(detail.expires_at)}
        </Text>
        <Text style={[styles.meta, { color: theme.inkMuted }]}>
          {formatShortPlace({
            city: detail.city,
            state: detail.state,
            postalCode: detail.postal_code,
          })}{" "}
          · {detail.stores_targeted} store
          {detail.stores_targeted === 1 ? "" : "s"} asked
        </Text>
      </GlassCard>

      <Text style={[styles.section, { color: theme.inkMuted }]}>Responses</Text>
        {responses.length === 0 ? (
          <GlassEmptyState
            title={
              detail.stores_targeted === 0
                ? "No participating stores nearby yet."
                : "Waiting for stores…"
            }
            description={
              detail.stores_targeted === 0
                ? "We saved this ask. Try another ZIP, or check back as more stores join."
                : WAITING_FOR_REPLY_HINT
            }
          />
        ) : (
          visibleResponses.map((r) => {
            const store = r.store as
              | {
                  name?: string;
                  street_address?: string;
                  city?: string;
                  state?: string;
                  postal_code?: string;
                  is_verified?: boolean;
                  // Selected by `store:stores(*)` and passed to
                  // `mapsDirectionsUrl`, which prefers coordinates over the
                  // address when it has them.
                  latitude?: number | null;
                  longitude?: number | null;
                }
              | undefined;
            const tone = toneForResponse(r.response_type);
            return (
              <GlassCard key={r.id} padded={false} style={styles.responseCard}>
                <StatusRail tone={tone} />
                <View style={styles.responseBody}>
                <StatusPill tone={tone} />
                <View style={styles.storeRow}>
                  <Text style={[styles.store, { color: theme.ink, flex: 1 }]}>
                    {store?.name || "Store"}
                  </Text>
                  {store?.is_verified ? (
                    <View style={styles.verified}>
                      <View style={styles.verifiedMark} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
                {r.price != null ? (
                  <Text style={[styles.price, { color: theme.ink }]}>${Number(r.price).toFixed(2)}</Text>
                ) : null}
                {r.note ? <Text style={[styles.meta, { color: theme.inkMuted }]}>{r.note}</Text> : null}
                <Text style={[styles.timestamp, { color: theme.inkSubtle }]}>{formatRelativeTime(r.created_at)}</Text>
                <View style={styles.links}>
                  {store?.street_address && r.response_type !== "out_of_stock" ? (
                    <Text
                      style={[styles.link, { color: theme.inkMuted }]}
                      onPress={async () => {
                        const url = mapsDirectionsUrl(
                          {
                            street_address: store.street_address!,
                            city: store.city || "",
                            state: store.state || "",
                            postal_code: store.postal_code || "",
                            latitude: store.latitude,
                            longitude: store.longitude,
                          },
                          Platform.OS === "ios"
                            ? "iPhone"
                            : Platform.OS === "android"
                              ? "Android"
                              : ""
                        );
                        const row = buildAnalyticsEvent("directions_tapped", {
                          requestId: detail.id,
                          storeId: r.store_id,
                        });
                        await supabase.from("analytics_events").insert({
                          event_name: row.event_name,
                          request_id: row.request_id,
                          store_id: row.store_id,
                          metadata: row.metadata,
                        });
                        Linking.openURL(url);
                      }}
                    >
                      Directions
                    </Text>
                  ) : null}
                  {!closed && r.response_type !== "out_of_stock" ? (
                    <Text
                      style={[styles.link, { color: theme.inkMuted }]}
                      onPress={() => {
                        if (busy) return;
                        setSelectedStoreId(r.store_id);
                        setFoundStep("ask");
                      }}
                    >
                      I found it here
                    </Text>
                  ) : null}
                </View>
                </View>
              </GlassCard>
            );
          })
        )}
        {hiddenStoreCount > 0 ? (
          <GlassButton
            title="Show more stores"
            variant="glass"
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              setVisibleStoreCount((count) => count + STORES_PAGE_SIZE)
            }
          />
        ) : null}

        {foundStep === "ask" ? (
          <GlassCard style={styles.actions}>
            <Text style={[styles.store, { color: theme.ink }]}>Did FINDIT help you find this product?</Text>
            <View style={styles.askRow}>
              <GlassButton
                title="Yes"
                style={styles.half}
                disabled={busy}
                onPress={async () => {
                  await run(
                    () =>
                      fulfillRequest({
                        requestId: detail.id,
                        storeId: selectedStoreId,
                        foundWithFindit: true,
                      }),
                    "Marked as found"
                  );
                  setFoundStep("done");
                }}
              />
              <GlassButton
                title="Not yet"
                variant="glass"
                style={styles.half}
                disabled={busy}
                onPress={async () => {
                  await run(
                    () =>
                      fulfillRequest({
                        requestId: detail.id,
                        storeId: selectedStoreId,
                        foundWithFindit: false,
                      }),
                    "Marked as found"
                  );
                  setFoundStep("done");
                }}
              />
            </View>
          </GlassCard>
        ) : null}

        {notice ? <Text style={[styles.notice, { color: theme.inkMuted }]}>{notice}</Text> : null}

        <View style={styles.actions}>
          {!closed ? (
            <>
              <GlassButton
                title="I found it"
                disabled={busy}
                onPress={() => {
                  const stocked = responses.find((r) => r.response_type === "in_stock");
                  setSelectedStoreId(stocked?.store_id || null);
                  setFoundStep("ask");
                }}
              />
              <GlassButton
                title="Still looking"
                variant="glass"
                disabled={busy}
                onPress={() => {
                  if (busy) return;
                  run(() => stillLooking(detail.id), "Stores will see you're still looking");
                }}
              />
              <View style={styles.footerRow}>
                <GlassButton
                  title="Save"
                  variant="glass"
                  style={styles.half}
                  disabled={busy}
                  onPress={() => void saveAndGoToRequests()}
                />
                <GlassButton
                  title="Cancel"
                  variant="ghost"
                  style={styles.half}
                  disabled={busy}
                  onPress={() => {
                    if (busy) return;
                    Alert.alert(
                      "Cancel this Find?",
                      "Stores will stop seeing it. This still counts as one of your Finds this month.",
                      [
                        { text: "Keep looking", style: "cancel" },
                        {
                          text: "Cancel",
                          style: "destructive",
                          onPress: () =>
                            run(() => cancelRequest(detail.id), "Request cancelled"),
                        },
                      ]
                    );
                  }}
                />
              </View>
            </>
          ) : (
            <GlassButton
              title="Save"
              variant="glass"
              disabled={busy}
              onPress={() => void saveAndGoToRequests()}
            />
          )}
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  centerPadded: { justifyContent: "center", padding: spacing.xl },
  title: {
    fontSize: typography.size.title3,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.tracking.title,
  },
  meta: {
    marginTop: spacing.sm,
    fontSize: typography.size.footnote,
    lineHeight: 19,
    textTransform: "capitalize",
  },
  section: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  responseCard: { marginBottom: spacing.sm, overflow: "hidden" },
  responseBody: { padding: spacing.lg, paddingLeft: spacing.lg + 6 },
  storeRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  store: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1D9BF0",
  },
  verifiedText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: "#1D9BF0",
  },
  price: {
    marginTop: spacing.xs,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  timestamp: {
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  link: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
    minHeight: 44,
    lineHeight: 44,
  },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  footerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  askRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  half: { flexGrow: 1, minWidth: 140, maxWidth: "100%" },
  notice: {
    marginTop: spacing.md,
    fontSize: typography.size.footnote,
    textAlign: "center",
  },
});
