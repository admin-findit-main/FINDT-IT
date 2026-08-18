import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatRelativeTime } from "@findit/domain";
import type { Notification } from "@findit/types";
import { radius, spacing, typography } from "@findit/theme";
import { GlassCard, GlassEmptyState, useAppTheme } from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { fetchNotifications, markNotificationRead } from "@/lib/api";

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
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
    <AppChrome title="Alerts">
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
      >
        {items.length === 0 ? (
          <GlassEmptyState
            title="No alerts yet."
            description="When a store answers, it shows up here."
          />
        ) : (
          <GlassCard padded={false}>
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={({ pressed }) => [
                  styles.row,
                  index < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.hairlineStrong,
                  },
                  pressed && { backgroundColor: theme.solid3 },
                ]}
                onPress={async () => {
                  await markNotificationRead(item.id);
                  if (item.related_request_id) {
                    router.push(`/(app)/request/${item.related_request_id}`);
                  }
                  load();
                }}
              >
                {!item.read_at ? (
                  <View style={[styles.dot, { backgroundColor: theme.ink }]} />
                ) : (
                  <View style={styles.dotSpacer} />
                )}
                <View style={styles.body}>
                  <Text
                    style={{ color: theme.ink, fontSize: typography.size.body, fontWeight: typography.weight.semibold }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: theme.inkMuted, marginTop: 3, fontSize: typography.size.footnote, lineHeight: 18 }}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                  <Text style={{ color: theme.inkSubtle, marginTop: spacing.sm, fontSize: typography.size.caption }}>
                    {formatRelativeTime(item.created_at)}
                  </Text>
                </View>
                {item.related_request_id ? (
                  <FontAwesome
                    name="chevron-right"
                    size={13}
                    color={theme.inkSubtle}
                    style={{ marginTop: 6 }}
                  />
                ) : null}
              </Pressable>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginTop: 7,
    marginRight: spacing.md,
  },
  dotSpacer: { width: 7, marginRight: spacing.md },
  body: { flex: 1, minWidth: 0 },
});
