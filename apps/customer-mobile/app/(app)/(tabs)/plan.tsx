import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  customerPlanCatalog,
  getConsumerEntitlements,
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
          search. Billing is not live, so you cannot buy FINDIT+ yet.
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
                  backgroundColor: theme.accentSoft,
                  borderColor: theme.accentRing,
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
                  <Text style={[styles.who, { color: theme.ink }]}>{plan.who}</Text>
                </View>
                <Text style={[styles.price, { color: theme.ink }]}>
                  {plan.priceLabel}
                </Text>
              </View>
              {current ? (
                <Text style={[styles.badge, { color: theme.accentInk }]}>
                  Your plan
                </Text>
              ) : null}

              <Text style={[styles.group, { color: theme.inkMuted }]}>Pros</Text>
              {plan.pros.map((item) => (
                <Text key={item} style={[styles.bullet, { color: theme.ink }]}>
                  • {item}
                </Text>
              ))}
              <Text style={[styles.group, { color: theme.inkMuted, marginTop: spacing.md }]}>
                Cons
              </Text>
              {plan.cons.map((item) => (
                <Text key={item} style={[styles.bullet, { color: theme.inkMuted }]}>
                  • {item}
                </Text>
              ))}
            </GlassCard>
          );
        })}

        <GlassCard>
          <Text style={[styles.planName, { color: theme.ink }]}>
            {catalog.business.name}
          </Text>
          <Text style={[styles.who, { color: theme.ink, marginTop: 6 }]}>
            {catalog.business.priceLabel}
          </Text>
          <Text style={[styles.tagline, { color: theme.inkMuted, marginTop: 8 }]}>
            {catalog.business.detail}
          </Text>
        </GlassCard>
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
  plusMark: { height: 22, width: 94 },
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
  badge: {
    marginTop: spacing.sm,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
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
