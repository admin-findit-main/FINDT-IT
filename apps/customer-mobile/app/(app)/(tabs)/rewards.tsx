import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { spacing, typography } from "@findit/theme";
import {
  GlassCard,
  ScreenTitle,
  useAppTheme,
} from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { fetchMyStoreRewards } from "@/lib/api";

type RewardRow = {
  id: string;
  points_balance: number;
  confirmed_purchases: number;
  last_seen_at: string;
  store?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

export default function RewardsScreen() {
  const theme = useAppTheme();
  const [rows, setRows] = useState<RewardRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows((await fetchMyStoreRewards()) as RewardRow[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <AppChrome title="Rewards">
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ScreenTitle
          title="Rewards"
          subtitle="FINDIT Points and store rewards stay separate."
        />
        <GlassCard>
          <Text style={[styles.name, { color: theme.ink }]}>FINDIT Points</Text>
          <Text style={[styles.muted, { color: theme.inkMuted }]}>
            Platform participation rewards. Open the FINDIT web Rewards page for your
            full FINDIT Points balance while mobile parity is finishing.
          </Text>
        </GlassCard>
        <Text
          style={[
            styles.section,
            { color: theme.inkMuted, marginTop: spacing.md },
          ]}
        >
          STORE REWARDS
        </Text>
        <Text style={[styles.muted, { color: theme.inkMuted, marginBottom: spacing.sm }]}>
          Points funded by each store after a Hub purchase confirm.
        </Text>
        {rows.length === 0 ? (
          <GlassCard>
            <Text style={[styles.muted, { color: theme.inkMuted }]}>
              Store points appear after an employee confirms your purchase.
            </Text>
          </GlassCard>
        ) : (
          rows.map((row) => {
            const store = Array.isArray(row.store) ? row.store[0] : row.store;
            return (
              <GlassCard key={row.id}>
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
                      {store?.name || "Store"}
                    </Text>
                    <Text style={[styles.muted, { color: theme.inkMuted }]}>
                      {row.confirmed_purchases} confirmed purchase
                      {row.confirmed_purchases === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.points, { color: theme.ink }]}>
                      {row.points_balance}
                    </Text>
                    <Text style={[styles.label, { color: theme.inkMuted }]}>STORE PTS</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  grow: { flex: 1 },
  name: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  muted: {
    fontSize: typography.size.caption,
    marginTop: spacing.xs,
  },
  points: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.bold,
    textAlign: "right",
  },
  label: {
    fontSize: typography.size.caption,
    letterSpacing: typography.tracking.overline,
    textAlign: "right",
  },
  section: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.tracking.overline,
  },
});
