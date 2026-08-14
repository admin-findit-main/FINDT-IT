import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { formatRelativeTime } from "@findit/domain";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassCard,
  GlassEmptyState,
  StatusPill,
  StatusRail,
  toneForResponse,
} from "@findit/theme/native";
import { fetchActivity } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTabContentInset } from "@/components/useTabContentInset";

export default function ActivityScreen() {
  const { activeStore } = useAuth();
  const { paddingBottom } = useTabContentInset();
  const [items, setItems] = useState<
    {
      id: string;
      response_type: string;
      created_at: string;
      request?: { product_name?: string } | { product_name?: string }[] | null;
    }[]
  >([]);

  const load = useCallback(async () => {
    if (!activeStore) return;
    setItems(await fetchActivity(activeStore.id));
  }, [activeStore]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <GlassBackdrop>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom,
          gap: spacing.md,
        }}
        ListEmptyComponent={<GlassEmptyState title="No responses yet today." />}
        renderItem={({ item }) => {
          const req = Array.isArray(item.request) ? item.request[0] : item.request;
          const tone = toneForResponse(item.response_type);
          return (
            <GlassCard level="base" padded={false}>
              <StatusRail tone={tone} />
              <View style={styles.body}>
                <View style={styles.top}>
                  <StatusPill tone={tone} />
                  <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {req?.product_name || "Request"}
                </Text>
              </View>
            </GlassCard>
          );
        }}
      />
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.lg,
    paddingRight: spacing.lg,
    paddingLeft: spacing.lg + 4,
  },
  top: {
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
  title: {
    color: theme.ink,
    fontSize: typography.size.callout,
    fontWeight: typography.weight.bold,
    marginTop: spacing.md,
  },
});
