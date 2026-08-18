import { useRouter, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CUSTOMER_PLANS } from "@findit/domain";
import { spacing, typography } from "@findit/theme";
import { GlassBackdrop, GlassButton, useAppTheme } from "@findit/theme/native";
import { BrandMark, BrandPlus } from "@/components/brand";
import { markOnboardingSeen } from "@/lib/onboarding";

const free = CUSTOMER_PLANS.free;
const plus = CUSTOMER_PLANS.plus;

const PAGES = [
  {
    kicker: "FINDIT",
    title: "Ask nearby stores who has it.",
    body: "Need a specific product tonight? Tell FINDIT what you’re looking for. We ask stores around you. They reply if it’s in stock, they can order it, or they don’t have it — then you go pick it up.",
    perks: [] as string[],
  },
  {
    kicker: "FINDIT+",
    title: "More Finds each month.",
    body: `Free FINDIT includes ${free.monthlyRequests} Finds a month. FINDIT+ raises that to ${plus.monthlyRequests} so you can keep asking without waiting.`,
    perks: [
      `${plus.monthlyRequests} Finds / month on FINDIT+`,
      `${free.monthlyRequests} Finds / month on free FINDIT`,
    ],
  },
  {
    kicker: "FINDIT+",
    title: "Search farther.",
    body: `Free searches up to ${free.maxRadiusMiles} miles. FINDIT+ goes to ${plus.maxRadiusMiles} miles, and Expand Search asks farther stores when nobody nearby has it.`,
    perks: [`Up to ${plus.maxRadiusMiles} miles`, "Expand Search"],
  },
  {
    kicker: "FINDIT+",
    title: "Save what you need.",
    body: "Save Finds and get alerts when it’s worth checking again. Billing is not live yet — you can start on free FINDIT today.",
    perks: ["Saved searches", "Alerts when a Find is worth checking again"],
  },
] as const;

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === PAGES.length - 1;

  const finish = async (href: Href) => {
    await markOnboardingSeen();
    router.replace(href);
  };

  const goNext = () => {
    if (last) {
      finish("/(auth)/signup");
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(PAGES.length - 1, next)));
  };

  const page = useMemo(() => PAGES[index], [index]);

  return (
    <GlassBackdrop>
      <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        {page.kicker === "FINDIT+" ? (
          <BrandPlus
            tone={theme.scheme === "dark" ? "dark" : "light"}
            style={styles.plusImg}
          />
        ) : (
          <BrandMark
            tone={theme.scheme === "dark" ? "dark" : "light"}
            style={styles.markImg}
          />
        )}
        {last ? (
          <View style={styles.skipSlot} />
        ) : (
          <Pressable
            onPress={() => finish("/(auth)/signup")}
            hitSlop={8}
            style={styles.skipPress}
          >
            <Text style={[styles.skip, { color: theme.inkMuted }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {PAGES.map((item) => (
          <View key={item.title} style={[styles.page, { width }]}>
            <Text style={[styles.title, { color: theme.ink }]}>{item.title}</Text>
            <Text style={[styles.body, { color: theme.inkMuted }]}>{item.body}</Text>
            {item.perks.length > 0 ? (
              <View style={styles.perks}>
                {item.perks.map((perk) => (
                  <Text key={perk} style={[styles.perk, { color: theme.ink }]}>
                    {perk}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.dots}>
          {PAGES.map((item, i) => (
            <View
              key={item.title}
              style={[
                styles.dot,
                { backgroundColor: theme.glass3 },
                i === index && { width: 18, backgroundColor: theme.ink },
              ]}
            />
          ))}
        </View>
        <GlassButton
          title={last ? "Create account" : "Continue"}
          size="lg"
          onPress={goNext}
        />
        {last ? (
          <Pressable
            onPress={() => finish("/(auth)/login")}
            style={styles.loginPress}
          >
            <Text style={[styles.login, { color: theme.inkMuted }]}>I already have an account</Text>
          </Pressable>
        ) : (
          <View style={styles.loginPress} />
        )}
      </View>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  markImg: { height: 28, width: 30 },
  plusImg: { height: 22, width: 94 },
  skipPress: { minHeight: 44, justifyContent: "center" },
  skipSlot: { minHeight: 44, minWidth: 44 },
  skip: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: typography.size.title1,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
    lineHeight: 36,
  },
  body: {
    fontSize: typography.size.body,
    lineHeight: 22,
    marginTop: spacing.lg,
  },
  perks: { marginTop: spacing.xl, gap: spacing.md },
  perk: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  loginPress: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  login: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
});
