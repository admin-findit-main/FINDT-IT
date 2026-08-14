import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text } from "react-native";
import {
  buildAnalyticsEvent,
  formatExpiresIn,
  formatRelativeTime,
  mapsDirectionsUrl,
} from "@findit/domain";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassEmptyState,
  StatusPill,
  StatusRail,
  toneForResponse,
} from "@findit/theme/native";
import { fetchRequestDetail, subscribeRequestRealtime } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Detail = Awaited<ReturnType<typeof fetchRequestDetail>>;

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchRequestDetail(id);
    setDetail(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    if (!id) return;
    const unsub = subscribeRequestRealtime(id, load);
    const poll = setInterval(load, 12000);
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

  const responses = [...(detail.responses || [])].sort((a, b) => {
    const order: Record<string, number> = {
      in_stock: 0,
      can_order: 1,
      out_of_stock: 2,
    };
    return (order[a.response_type] ?? 9) - (order[b.response_type] ?? 9);
  });

  return (
    <GlassBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard level="subtle">
          <Text style={styles.title}>{detail.product_name}</Text>
          <Text style={styles.meta}>
            {detail.status.replace(/_/g, " ")} · {formatExpiresIn(detail.expires_at)}
          </Text>
          <Text style={styles.meta}>
            {detail.city}, {detail.state} · {detail.stores_targeted} store
            {detail.stores_targeted === 1 ? "" : "s"} asked
          </Text>
        </GlassCard>

        <Text style={styles.section}>Live responses</Text>
        {responses.length === 0 ? (
          <GlassEmptyState title="Waiting for stores…" />
        ) : (
          responses.map((r) => {
            const store = r.store as
              | {
                  name?: string;
                  street_address?: string;
                  city?: string;
                  state?: string;
                  postal_code?: string;
                }
              | undefined;
            const tone = toneForResponse(r.response_type);
            return (
              <GlassCard key={r.id} style={styles.responseCard}>
                <StatusRail tone={tone} />
                <StatusPill tone={tone} />
                <Text style={styles.store}>{store?.name || "Store"}</Text>
                {r.price != null ? (
                  <Text style={styles.price}>${Number(r.price).toFixed(2)}</Text>
                ) : null}
                {r.note ? <Text style={styles.meta}>{r.note}</Text> : null}
                <Text style={styles.timestamp}>{formatRelativeTime(r.created_at)}</Text>
                {store?.street_address && r.response_type !== "out_of_stock" ? (
                  <GlassButton
                    title="Directions"
                    style={styles.directions}
                    onPress={async () => {
                      const url = mapsDirectionsUrl({
                        street_address: store.street_address!,
                        city: store.city || "",
                        state: store.state || "",
                        postal_code: store.postal_code || "",
                      });
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
                  />
                ) : null}
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  center: { alignItems: "center", justifyContent: "center" },
  centerPadded: { justifyContent: "center", padding: spacing.xl },
  title: {
    color: theme.ink,
    fontSize: typography.size.title2,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.title,
  },
  meta: {
    color: theme.inkMuted,
    marginTop: spacing.sm,
    fontSize: typography.size.footnote,
    lineHeight: 19,
    textTransform: "capitalize",
  },
  section: {
    color: theme.ink,
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  responseCard: { paddingLeft: spacing.lg + spacing.xs, marginBottom: spacing.md },
  store: {
    color: theme.ink,
    fontSize: typography.size.callout,
    fontWeight: typography.weight.bold,
    marginTop: spacing.sm,
  },
  price: {
    color: theme.ink,
    marginTop: spacing.xs,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  timestamp: {
    color: theme.inkSubtle,
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
  },
  directions: { marginTop: spacing.md },
});
