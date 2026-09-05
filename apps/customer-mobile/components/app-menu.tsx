import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { usePathname, useRouter, useSegments, type Href } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  accountContactLabel,
  displayName,
  formatShortPlace,
  getConsumerEntitlements,
} from "@findit/domain";
import { radius, spacing, typography } from "@findit/theme";
import {
  GlassHeaderBackground,
  useAppTheme,
  useReducedMotion,
} from "@findit/theme/native";
import { BrandMark } from "@/components/brand";
import { useAuth } from "@/lib/auth";

const ITEMS: {
  href: Href;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  match: "index" | "requests" | "notifications" | "plan" | "profile";
}[] = [
  { href: "/(app)/(tabs)", label: "Find", icon: "search", match: "index" },
  { href: "/(app)/(tabs)/requests", label: "Requests", icon: "list", match: "requests" },
  { href: "/(app)/(tabs)/notifications", label: "Alerts", icon: "bell", match: "notifications" },
  { href: "/(app)/(tabs)/plan", label: "Plan", icon: "star", match: "plan" },
  { href: "/(app)/(tabs)/profile", label: "Profile", icon: "user", match: "profile" },
];

const OPEN_CURVE = Easing.bezier(0.32, 0.72, 0, 1);
const OPEN_MS = 340;

function activeMenuKey(pathname: string, segments: string[]) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path.includes("/request/")) return "requests";
  const leaf = segments.filter(Boolean).at(-1) || "";
  if (leaf === "requests" || leaf === "notifications" || leaf === "profile" || leaf === "plan") {
    return leaf;
  }
  if (path.includes("/requests")) return "requests";
  if (path.includes("/notifications")) return "notifications";
  if (path.includes("/plan")) return "plan";
  if (path.includes("/profile")) return "profile";
  return "index";
}

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

export function CustomerMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <MenuContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <CustomerMenuDrawer />
      </View>
    </MenuContext.Provider>
  );
}

function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) {
    throw new Error("CustomerMenuProvider is missing");
  }
  return ctx;
}

export function MenuButton() {
  const theme = useAppTheme();
  const { setOpen } = useMenu();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.35 }]}
    >
      <FontAwesome name="bars" size={20} color={theme.ink} />
    </Pressable>
  );
}

export function AppChrome({
  title,
  brand = false,
  children,
}: {
  title?: string;
  brand?: boolean;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: theme.canvas }]}>
      <View style={styles.headerWrap}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GlassHeaderBackground />
        </View>
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          <MenuButton />
          <View style={styles.headerCenter} pointerEvents="none">
            {brand ? (
              <BrandMark
                tone={theme.scheme === "dark" ? "dark" : "light"}
                style={styles.headerMark}
              />
            ) : (
              <Text style={[styles.headerTitle, { color: theme.ink }]} numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>
          <View style={styles.iconBtn} />
        </View>
      </View>
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

function PlanWordmark({ plus }: { plus: boolean }) {
  const theme = useAppTheme();
  return (
    <Text style={[styles.wordmark, { color: theme.ink }]}>
      FINDIT
      {plus ? <Text style={{ color: theme.accent }}>+</Text> : null}
    </Text>
  );
}

function CustomerMenuDrawer() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { profile } = useAuth();
  const { open, setOpen } = useMenu();
  const reducedMotion = useReducedMotion();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const plus = entitlements.planId === "plus";
  const name = displayName(profile || {});
  const contact = accountContactLabel(profile || {});
  const place = formatShortPlace({
    city: profile?.default_city,
    state: profile?.default_state,
    postalCode: profile?.default_postal_code,
  });
  const selected = activeMenuKey(pathname, segments as string[]);
  const onRequest = pathname.includes("/request/");
  const panelWidth = Math.min(320, Math.round(width * 0.82));
  const duration = reducedMotion ? 1 : OPEN_MS;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration,
      easing: OPEN_CURVE,
    });
  }, [open, duration, progress]);

  const close = () => setOpen(false);
  const finishOpen = (next: boolean) => setOpen(next);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-panelWidth, 0]),
      },
    ],
  }));

  // The two writes below are Reanimated shared values assigned inside gesture
  // worklets on the UI thread. Mutating `.value` is that library's only API for
  // it; the lint rule sees the gesture built during render and cannot tell the
  // callbacks run later.
  const closePan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .onUpdate((event) => {
      const next = 1 + event.translationX / panelWidth;
      // eslint-disable-next-line react-hooks/immutability -- shared value, gesture worklet
      progress.value = Math.min(1, Math.max(0, next));
    })
    .onEnd((event) => {
      const shouldClose = event.velocityX < -650 || progress.value < 0.55;
      // eslint-disable-next-line react-hooks/immutability -- shared value, gesture worklet
      progress.value = withTiming(shouldClose ? 0 : 1, {
        duration,
        easing: OPEN_CURVE,
      });
      runOnJS(finishOpen)(!shouldClose);
    });

  const go = (href: Href, match: (typeof ITEMS)[number]["match"]) => {
    if (selected === match && !onRequest) {
      setOpen(false);
      return;
    }
    router.navigate(href);
    setOpen(false);
  };

  const frostTint =
    theme.scheme === "dark" ? ("systemMaterialDark" as const) : ("systemMaterialLight" as const);

  return (
    <View
      pointerEvents={open ? "box-none" : "none"}
      style={styles.overlay}
      accessibilityViewIsModal={open}
    >
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.scrim, scrimStyle]}
      >
        <Pressable
          accessibilityLabel="Close menu"
          onPress={close}
          style={styles.fill}
        />
      </Animated.View>

      <GestureDetector gesture={closePan}>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              backgroundColor: Platform.OS === "ios" ? "transparent" : theme.solid1,
            },
            panelStyle,
          ]}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              pointerEvents="none"
              intensity={80}
              tint={frostTint}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  Platform.OS === "ios"
                    ? theme.scheme === "dark"
                      ? "rgba(20,20,22,0.28)"
                      : "rgba(255,255,255,0.22)"
                    : "transparent",
              },
            ]}
          />

          <View style={styles.panelTop}>
            <PlanWordmark plus={plus} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={close}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.35 }]}
            >
              <FontAwesome name="times" size={18} color={theme.inkMuted} />
            </Pressable>
          </View>
          <Text style={[styles.tagline, { color: theme.inkMuted }]}>
            {plus
              ? "More Finds. Farther stores."
              : "Ask nearby stores who has it."}
          </Text>

          <View style={styles.nav}>
            {ITEMS.map((item) => {
              const active = selected === item.match;
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => go(item.href, item.match)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && { backgroundColor: theme.accentSoft },
                    pressed && !active && { backgroundColor: theme.solid3 },
                  ]}
                >
                  <View
                    style={[
                      styles.navRail,
                      { backgroundColor: active ? theme.accent : "transparent" },
                    ]}
                  />
                  <FontAwesome
                    name={item.icon}
                    size={16}
                    color={active ? theme.accent : theme.inkMuted}
                    style={styles.navIcon}
                  />
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: active ? theme.ink : theme.inkMuted,
                        fontWeight: active
                          ? typography.weight.bold
                          : typography.weight.semibold,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile and place"
            onPress={() => go("/(app)/(tabs)/profile", "profile")}
            style={({ pressed }) => [
              styles.account,
              {
                backgroundColor: theme.solidChrome,
                borderColor: theme.hairlineStrong,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.ink }]}>
              <Text style={[styles.avatarLetter, { color: theme.inkInverse }]}>
                {(name || "F").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountCopy}>
              <Text style={[styles.footerName, { color: theme.ink }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.footerMeta, { color: theme.inkMuted }]} numberOfLines={1}>
                {contact}
              </Text>
              <View style={styles.placeRow}>
                <FontAwesome name="map-marker" size={11} color={theme.inkSubtle} />
                <Text style={[styles.footerPlace, { color: theme.inkSubtle }]} numberOfLines={1}>
                  {place || "Add your city"}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerWrap: {
    zIndex: 1,
  },
  headerRow: {
    height: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.tracking.body,
  },
  headerMark: { height: 32, width: 34 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: "column",
    paddingHorizontal: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 18,
  },
  panelTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
  },
  tagline: {
    marginTop: 2,
    fontSize: typography.size.footnote,
  },
  nav: { marginTop: spacing.xl, gap: spacing.xs },
  navItem: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingRight: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  navRail: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: spacing.sm,
    marginLeft: 6,
  },
  navIcon: { width: 28 },
  navLabel: {
    fontSize: typography.size.body,
  },
  account: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  accountCopy: { flex: 1, minWidth: 0 },
  footerName: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  footerMeta: {
    marginTop: 2,
    fontSize: typography.size.caption,
    lineHeight: 16,
  },
  placeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerPlace: {
    flex: 1,
    fontSize: typography.size.caption,
    lineHeight: 16,
  },
});
