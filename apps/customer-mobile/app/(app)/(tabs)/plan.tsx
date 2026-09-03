import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  customerPlanCatalog,
  getConsumerEntitlements,
  PAYMENTS_COMING_SOON_BODY,
  PAYMENTS_COMING_SOON_NOTE,
  PAYMENTS_COMING_SOON_TITLE,
} from "@findit/domain";
import { spacing, typography } from "@findit/theme";
import { GlassCard, useAppTheme } from "@findit/theme/native";
import { AppChrome } from "@/components/app-menu";
import { BrandPlus } from "@/components/brand";
import { fetchPlanUsage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function PlanScreen() {
  const theme = useAppTheme();
  const { profile } = useAuth();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const catalog = useMemo(() => customerPlanCatalog(), []);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanUsage().then((usage) => {
      if (!usage) return;
      setUsageLabel(`${usage.used} / ${usage.limit} Finds used this month`);
    });
  }, [profile?.subscription_plan]);

  return (
    <AppChrome title="Plan">
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical
      >
        <Text style={[styles.intro, { color: theme.inkMuted }]}>
          FINDIT is free. FINDIT+ is the same account with more Finds and a wider
          search.
        </Text>
        <Text style={[styles.current, { color: theme.ink }]}>
          You’re on {entitlements.brandName}
          {usageLabel ? `. ${usageLabel}.` : "."}
        </Text>

        {catalog.plans.map((plan) => {
          const current = plan.id === entitlements.planId;
          return (
            <GlassCard
              key={plan.id}
              style={[
                styles.card,
                current && {
                  backgroundColor: "rgba(229, 35, 27, 0.28)",
                  borderColor: theme.accent,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <View style={styles.fill}>
                  {plan.id === "plus" ? (
                    <BrandPlus
                      tone={theme.scheme === "dark" ? "dark" : "light"}
                      style={styles.plusMark}
                    />
                  ) : (
                    <Text style={[styles.planName, { color: theme.ink }]}>
                      {plan.name}
                    </Text>
                  )}
                  <Text style={[styles.tagline, { color: theme.inkMuted }]}>
                    {plan.tagline}
                  </Text>
                </View>
                <View style={styles.selectCol}>
                  <Text style={[styles.price, { color: theme.ink }]}>
                    {plan.priceLabel}
                  </Text>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: current ? theme.accent : theme.hairlineStrong },
                    ]}
                  >
                    {current ? (
                      <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />
                    ) : null}
                  </View>
                </View>
              </View>
              {current ? (
                <View style={[styles.badgeWrap, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badge}>Your plan</Text>
                </View>
              ) : null}

              {plan.pros.map((item) => (
                <Text key={item} style={[styles.bullet, { color: theme.ink }]}>
                  • {item}
                </Text>
              ))}
            </GlassCard>
          );
        })}

        {catalog.billingLive ? null : (
          <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <FontAwesome name="credit-card" size={22} color={theme.inkMuted} />
            <Text style={[styles.planName, { color: theme.ink, marginTop: spacing.sm }]}>
              {PAYMENTS_COMING_SOON_TITLE}
            </Text>
            <Text style={[styles.tagline, { color: theme.inkMuted, textAlign: "center" }]}>
              {PAYMENTS_COMING_SOON_BODY}
            </Text>
            <Text style={[styles.tagline, { color: theme.inkMuted, textAlign: "center" }]}>
              {PAYMENTS_COMING_SOON_NOTE}
            </Text>
          </View>
        )}
      </ScrollView>
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  current: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  intro: {
    fontSize: typography.size.footnote,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.xs },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  fill: { flex: 1, minWidth: 0 },
  selectCol: { alignItems: "flex-end", gap: spacing.sm },
  plusMark: { height: 24, width: 107 },
  planName: {
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
  },
  price: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.semibold,
    textAlign: "right",
    maxWidth: 120,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tagline: {
    marginTop: 4,
    fontSize: typography.size.footnote,
    lineHeight: 18,
  },
  who: {
    marginTop: 4,
    fontSize: typography.size.footnote,
    lineHeight: 18,
  },
  badgeWrap: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badge: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  group: {
    marginTop: spacing.md,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  bullet: {
    marginTop: 6,
    fontSize: typography.size.footnote,
    lineHeight: 18,
  },
});
