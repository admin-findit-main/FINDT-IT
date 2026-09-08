import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { spacing, typography } from "@findit/theme";
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
  ScreenTitle,
  useAppTheme,
} from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { connectStoreRewards, fetchMyStoreRewards } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type RewardRow = {
  id: string;
  points_balance: number;
  confirmed_purchases: number;
  last_seen_at: string;
  store?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

function formatCodeInput(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, "$1-");
}

export default function RewardsScreen() {
  const theme = useAppTheme();
  const { profile } = useAuth();
  const [rows, setRows] = useState<RewardRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [phone, setPhone] = useState(profile?.phone_e164 || "");
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows((await fetchMyStoreRewards()) as RewardRow[]);
  }, []);

  useEffect(() => {
    if (profile?.phone_e164) {
      setPhone((current) => current || profile.phone_e164 || "");
    }
  }, [profile?.phone_e164]);

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
          title="Store rewards"
          subtitle="Points funded by each participating store."
        />
        <GlassCard>
          <Text style={[styles.name, { color: theme.ink }]}>
            Connect store rewards
          </Text>
          <Text style={[styles.copy, { color: theme.inkMuted }]}>
            Enter the phone you gave the store and its recovery code. The
            code—not your phone—proves the rewards are yours.
          </Text>
          <GlassInput
            label="Store phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="(571) 259-9714"
          />
          <GlassInput
            label="12-character recovery code"
            value={code}
            onChangeText={(value) => setCode(formatCodeInput(value))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
            placeholder="ABCD-2345-WXYZ"
            style={styles.code}
          />
          {claimError ? <GlassNotice>{claimError}</GlassNotice> : null}
          {claimSuccess ? (
            <GlassNotice tone="muted">{claimSuccess}</GlassNotice>
          ) : null}
          <GlassButton
            title={connecting ? "Connecting…" : "Connect store rewards"}
            loading={connecting}
            disabled={
              connecting ||
              !phone.trim() ||
              code.replace(/-/g, "").length !== 12
            }
            onPress={async () => {
              setConnecting(true);
              setClaimError(null);
              setClaimSuccess(null);
              const result = await connectStoreRewards({ phone, code });
              setConnecting(false);
              if (!result.ok) {
                setClaimError(result.error);
                return;
              }
              setCode("");
              setClaimSuccess(
                `${result.storeName} connected — ${result.pointsBalance} points.`
              );
              await load();
            }}
          />
        </GlassCard>
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
                    <Text style={[styles.label, { color: theme.inkMuted }]}>POINTS</Text>
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
  copy: {
    fontSize: typography.size.footnote,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  code: {
    fontFamily: "Courier",
    letterSpacing: 1.5,
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
});
