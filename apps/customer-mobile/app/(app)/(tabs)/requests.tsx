import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatExpiresIn, formatRelativeTime, isActivelySearching } from "@findit/domain";
import type { CustomerRequest } from "@findit/types";
import { radius, spacing, typography } from "@findit/theme";
import { GlassCard, GlassEmptyState, GlassSurface, useAppTheme } from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { fetchMyRequests } from "@/lib/api";

type Tab = "active" | "past" | "saved";

export default function RequestsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<CustomerRequest[]>([]);

  const load = useCallback(async () => {
    const data = await fetchMyRequests(tab);
    setItems(data as CustomerRequest[]);
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 20000);
      return () => clearInterval(t);
    }, [load])
  );

  const label = (t: Tab) =>
    t === "active" ? "Active" : t === "past" ? "Completed" : "Saved";

  return (
    <AppChrome title="Requests">
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
      >
        <GlassSurface level="subtle" cornerRadius={radius.md} style={[styles.segment, { backgroundColor: theme.solid3 }]}>
          {(["active", "past", "saved"] as const).map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.segmentItem, on && { backgroundColor: theme.solid1 }]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: on ? theme.ink : theme.inkMuted,
                    fontSize: typography.size.footnote,
                    fontWeight: on ? typography.weight.semibold : typography.weight.medium,
                  }}
                >
                  {label(t)}
                </Text>
              </Pressable>
            );
          })}
        </GlassSurface>

        {items.length === 0 ? (
          <GlassEmptyState
            title={
              tab === "saved"
                ? "Nothing saved yet."
                : tab === "past"
                  ? "Nothing completed yet."
                  : "No Finds yet."
            }
            description={
              tab === "active" ? "Ask nearby stores from Find." : undefined
            }
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
                onPress={() => router.push(`/(app)/request/${item.id}`)}
              >
                <View style={styles.rowBody}>
                  <Text style={{ color: theme.ink, fontSize: typography.size.body, fontWeight: typography.weight.semibold }} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text
                    style={{ color: theme.inkMuted, marginTop: 3, fontSize: typography.size.caption, textTransform: "capitalize" }}
                    numberOfLines={1}
                  >
                    {item.status.replace(/_/g, " ")} · {formatRelativeTime(item.created_at)}
                    {isActivelySearching(item.status) ? ` · ${formatExpiresIn(item.expires_at)}` : ""}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={13} color={theme.inkSubtle} />
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
  segment: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
    marginBottom: spacing.md,
  },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
});
