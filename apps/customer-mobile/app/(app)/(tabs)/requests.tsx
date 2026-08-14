import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { formatExpiresIn, formatRelativeTime, isActivelySearching } from "@findit/domain";
import type { CustomerRequest } from "@findit/types";
import { radius, spacing, theme, typography } from "@findit/theme";
import { GlassBackdrop, GlassCard, GlassEmptyState, GlassSurface } from "@findit/theme/native";
import { fetchMyRequests } from "@/lib/api";

export default function RequestsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [items, setItems] = useState<CustomerRequest[]>([]);

  const load = useCallback(async () => {
    const data = await fetchMyRequests(tab);
    setItems(data as CustomerRequest[]);
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load])
  );

  return (
    <GlassBackdrop>
      <GlassSurface level="subtle" cornerRadius={radius.pill} style={styles.segment}>
        {(["active", "past"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            style={[styles.segmentItem, tab === t && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextOn]}>
              {t === "active" ? "Active" : "Completed"}
            </Text>
          </Pressable>
        ))}
      </GlassSurface>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.xxl }]}
        ListEmptyComponent={<GlassEmptyState title={`No ${tab} requests yet.`} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardPress}
            onPress={() => router.push(`/(app)/request/${item.id}`)}
          >
            <GlassCard>
              <Text style={styles.title}>{item.product_name}</Text>
              <Text style={styles.meta}>
                {item.status.replace(/_/g, " ")} · {formatRelativeTime(item.created_at)}
              </Text>
              {isActivelySearching(item.status) ? (
                <Text style={styles.meta}>{formatExpiresIn(item.expires_at)}</Text>
              ) : null}
            </GlassCard>
          </Pressable>
        )}
      />
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemOn: { backgroundColor: theme.accent },
  segmentText: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  segmentTextOn: { color: theme.inkInverse },
  list: { padding: spacing.lg },
  cardPress: { marginBottom: spacing.md },
  title: {
    color: theme.ink,
    fontSize: typography.size.callout,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
  },
  meta: {
    color: theme.inkMuted,
    marginTop: spacing.xs,
    fontSize: typography.size.footnote,
    textTransform: "capitalize",
  },
});
