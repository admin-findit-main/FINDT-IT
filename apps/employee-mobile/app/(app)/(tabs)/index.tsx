import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatRelativeTime, privacySafeRequestPayload } from "@findit/domain";
import { radius, spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassCard,
  GlassEmptyState,
  GlassSurface,
  StatusPill,
  StatusRail,
  toneForResponse,
} from "@findit/theme/native";
import { fetchStoreQueue, subscribeStoreInbox } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTabContentInset } from "@/components/useTabContentInset";

type QueueItem = NonNullable<Awaited<ReturnType<typeof fetchStoreQueue>>[number]>;

export default function QueueScreen() {
  const { activeStore } = useAuth();
  const router = useRouter();
  const { tablet, paddingBottom } = useTabContentInset();
  const [items, setItems] = useState<QueueItem[]>([]);

  const load = useCallback(async () => {
    if (!activeStore) return;
    const data = await fetchStoreQueue(activeStore.id);
    setItems(data as QueueItem[]);
  }, [activeStore]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }, [load])
  );

  useEffect(() => {
    if (!activeStore) return;
    return subscribeStoreInbox(activeStore.id, load);
  }, [activeStore, load]);

  const waiting = items.filter((i) => !i.responseType);
  const answered = items.filter((i) => i.responseType);

  return (
    <GlassBackdrop>
      <View style={styles.header}>
        <Text style={styles.store} numberOfLines={1}>
          {activeStore?.name || "Store"}
        </Text>
        <Text style={styles.meta}>
          {waiting.length} waiting · terminal mode{tablet ? " · tablet" : ""}
        </Text>
      </View>
      <FlatList
        data={[...waiting, ...answered]}
        keyExtractor={(item) => item.targetId}
        numColumns={tablet ? 2 : 1}
        contentContainerStyle={{
          paddingHorizontal: tablet ? spacing.xl : spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom,
          gap: spacing.md,
        }}
        columnWrapperStyle={tablet ? { gap: spacing.md } : undefined}
        ListEmptyComponent={
          <GlassEmptyState title="No requests in today's queue." />
        }
        renderItem={({ item }) => {
          const safe = privacySafeRequestPayload({
            id: item.request.id,
            product_name: item.request.product_name,
            description: item.request.description,
            image_url: item.request.image_url,
            category: item.request.category,
            city: item.request.city,
            state: "",
            postal_code: "00000",
            created_at: item.request.created_at,
            expires_at: item.request.expires_at,
          });
          const answeredItem = Boolean(item.responseType);
          const tone = toneForResponse(item.responseType);
          return (
            <Pressable
              accessibilityRole="button"
              style={tablet ? { flex: 1 } : undefined}
              onPress={() => router.push(`/(app)/request/${item.request.id}`)}
            >
              {({ pressed }) => (
                <GlassCard
                  level={answeredItem ? "subtle" : "strong"}
                  padded={false}
                  style={[styles.card, answeredItem && styles.cardDone, pressed && styles.cardPressed]}
                >
                  <StatusRail tone={tone} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <StatusPill tone={tone} />
                      <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
                    </View>
                    <Text style={styles.product} numberOfLines={2}>
                      {safe.product_name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {safe.category || "Uncategorized"} · {safe.area_city}
                    </Text>
                    {answeredItem ? null : (
                      <GlassSurface level="subtle" cornerRadius={radius.md} style={styles.ctaWrap}>
                        <Text style={styles.cta}>TAP TO RESPOND</Text>
                      </GlassSurface>
                    )}
                  </View>
                </GlassCard>
              )}
            </Pressable>
          );
        }}
      />
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  store: {
    color: theme.ink,
    fontSize: typography.size.title2,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.title,
  },
  meta: {
    color: theme.inkMuted,
    fontSize: typography.size.footnote,
    marginTop: spacing.xs,
    textTransform: "capitalize",
  },
  card: { minHeight: 132 },
  cardDone: { opacity: 0.68 },
  cardPressed: { opacity: 0.9 },
  cardBody: {
    paddingVertical: spacing.lg,
    paddingRight: spacing.lg,
    paddingLeft: spacing.lg + 4,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  time: {
    color: theme.inkSubtle,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
  },
  product: {
    color: theme.ink,
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
    marginTop: spacing.md,
  },
  ctaWrap: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderColor: theme.accentRing,
    backgroundColor: theme.accentSoft,
  },
  cta: {
    color: theme.accentInk,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.overline,
  },
});
