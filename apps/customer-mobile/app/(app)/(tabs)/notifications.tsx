import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatRelativeTime } from "@findit/domain";
import type { Notification } from "@findit/types";
import { radius, spacing, theme, typography } from "@findit/theme";
import { GlassBackdrop, GlassCard, GlassEmptyState } from "@findit/theme/native";
import { fetchNotifications, markNotificationRead } from "@/lib/api";

export default function NotificationsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    setItems((await fetchNotifications()) as Notification[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 20000);
      return () => clearInterval(t);
    }, [load])
  );

  return (
    <GlassBackdrop>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.xxl }]}
        ListEmptyComponent={<GlassEmptyState title="No notifications yet." />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardPress}
            onPress={async () => {
              await markNotificationRead(item.id);
              if (item.related_request_id) {
                router.push(`/(app)/request/${item.related_request_id}`);
              }
              load();
            }}
          >
            <GlassCard
              level={item.read_at ? "subtle" : "base"}
              style={item.read_at ? undefined : styles.unread}
            >
              <View style={styles.titleRow}>
                {!item.read_at ? <View style={styles.dot} /> : null}
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>{formatRelativeTime(item.created_at)}</Text>
            </GlassCard>
          </Pressable>
        )}
      />
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  cardPress: { marginBottom: spacing.md },
  unread: { borderWidth: 1, borderColor: theme.accentRing },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.accent,
  },
  title: {
    flex: 1,
    color: theme.ink,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: theme.inkMuted,
    marginTop: spacing.xs,
    fontSize: typography.size.footnote,
    lineHeight: 19,
  },
  meta: {
    color: theme.inkSubtle,
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
  },
});
