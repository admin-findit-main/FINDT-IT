/**
 * Shared surfaces for the FINDIT React Native apps.
 *
 * Cards are opaque. Frosted blur is reserved for navigation chrome
 * (tab bar, headers, sheets) so the app reads as a native product, not a
 * glass demo.
 */
import { BlurTargetView, BlurView } from "expo-blur";
import * as React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ColorValue,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { blur, darkTheme, lightTheme, palette, radius, shadow, spacing, typography } from "./tokens";
import type { ColorSchemeName, SemanticTheme, StatusTone } from "./tokens";

/**
 * Tracks the OS "Reduce Transparency" setting so glass can degrade to solid.
 * Only iOS reports it; elsewhere we keep the blur.
 */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => {
        if (active) setReduced(Boolean(value));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceTransparencyChanged",
      (value: boolean) => setReduced(Boolean(value))
    );
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

/** Mirrors `useReducedTransparency` for motion-sensitive affordances. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(Boolean(value));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value: boolean) =>
      setReduced(Boolean(value))
    );
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

type GlassLevel = "subtle" | "base" | "strong" | "chrome";

const ThemeContext = React.createContext<SemanticTheme>(lightTheme);

export function AppThemeProvider({
  scheme,
  children,
}: {
  scheme: ColorSchemeName;
  children: React.ReactNode;
}) {
  const value = scheme === "light" ? lightTheme : darkTheme;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): SemanticTheme {
  return React.useContext(ThemeContext);
}

export function useColorSchemeName(): ColorSchemeName {
  return useAppTheme().scheme;
}

const LEVEL_INTENSITY: Record<GlassLevel, number> = {
  subtle: blur.subtle,
  base: blur.base,
  strong: blur.strong,
  chrome: blur.chrome,
};

function levelSolid(theme: SemanticTheme, level: GlassLevel) {
  if (level === "chrome") return theme.solidChrome;
  if (level === "strong") return theme.solid3;
  if (level === "subtle") return theme.solid1;
  return theme.solid2;
}

function iosChromeTint(scheme: ColorSchemeName) {
  return scheme === "light" ? ("systemChromeMaterialLight" as const) : ("systemChromeMaterialDark" as const);
}

/**
 * A ref to a `BlurTargetView`. Android can only blur content that is inside one,
 * so a screen opting into real Android blur wraps its background in
 * {@link GlassBlurTarget} and threads the ref down to each glass surface.
 */
export type BlurTargetRef = React.RefObject<View | null>;

/**
 * Android blurs nothing unless it is given a target, and `expo-blur` warns on
 * every mount if `blurMethod` is set without one. So we only request a blur
 * method when we actually have a target to blur.
 */
function androidBlurProps(blurTarget?: BlurTargetRef) {
  if (Platform.OS !== "android") return {};
  if (!blurTarget) return {};
  return { blurTarget, blurMethod: "dimezisBlurViewSdk31Plus" as const };
}

/** True when the surface will paint a flat wash rather than a genuine blur. */
function isFlatFallback(blurTarget?: BlurTargetRef) {
  return Platform.OS === "android" && !blurTarget;
}

/**
 * Wraps the content Android should sample when blurring. Render your screen
 * background inside this and pass the same ref to the glass surfaces above it.
 * A single target can back many blur views, which is cheaper than one each.
 */
export const GlassBlurTarget = BlurTargetView;

export type GlassSurfaceProps = ViewProps & {
  level?: GlassLevel;
  /** Corner radius; defaults to the large card radius. */
  cornerRadius?: number;
  /** Draw the hairline border. Turn off for full-bleed chrome. */
  bordered?: boolean;
  /** Opt into real blur on Android — see {@link GlassBlurTarget}. */
  blurTarget?: BlurTargetRef;
  children?: React.ReactNode;
};

/**
 * The base surface every other primitive builds on.
 * Cards stay opaque. Chrome (`level="chrome"`) may frost when the OS allows it.
 */
export function GlassSurface({
  level = "base",
  cornerRadius = radius.xl,
  bordered = true,
  blurTarget,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const theme = useAppTheme();
  const reduced = useReducedTransparency();
  const shape: ViewStyle = {
    borderRadius: cornerRadius,
    overflow: "hidden",
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: bordered ? theme.hairlineStrong : "transparent",
  };

  const useFrost = level === "chrome" && !reduced;

  if (!useFrost) {
    return (
      <View
        style={[shape, { backgroundColor: levelSolid(theme, level) }, style]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  const flat = isFlatFallback(blurTarget);

  return (
    <View style={[shape, style]} {...rest}>
      <BlurView
        intensity={LEVEL_INTENSITY[level]}
        tint={Platform.OS === "ios" ? iosChromeTint(theme.scheme) : theme.scheme}
        style={StyleSheet.absoluteFill}
        {...androidBlurProps(blurTarget)}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: flat ? theme.flatFill.chrome : theme.glassChrome },
        ]}
      />
      {children}
    </View>
  );
}

/** Grouped card: white on the canvas, no cheap drop shadow in light mode. */
export function GlassCard({
  style,
  children,
  padded = true,
  ...rest
}: GlassSurfaceProps & { padded?: boolean }) {
  const theme = useAppTheme();
  const lift = theme.scheme === "dark" ? shadow.card : undefined;
  return (
    <View style={[lift, { borderRadius: rest.cornerRadius ?? radius.lg }]}>
      <GlassSurface
        {...rest}
        style={[padded ? { padding: spacing.lg } : null, style]}
      >
        {children}
      </GlassSurface>
    </View>
  );
}

/** Screen canvas. Intentionally plain — cards and type do the work. */
export function GlassBackdrop({ children, style }: ViewProps) {
  const theme = useAppTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.canvas }, style]}>
      {children}
    </View>
  );
}

export type GlassButtonVariant = "accent" | "glass" | "ink" | "ghost";

export type GlassButtonProps = Omit<PressableProps, "style"> & {
  title: string;
  variant?: GlassButtonVariant;
  loading?: boolean;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/** Primary action surface. `accent` is brand red; `glass` is the translucent pill. */
export function GlassButton({
  title,
  variant = "accent",
  loading = false,
  size = "md",
  style,
  textStyle,
  disabled,
  ...rest
}: GlassButtonProps) {
  const theme = useAppTheme();
  // The `glass` variant delegates to GlassSurface, which handles reduced
  // transparency itself; the solid variants have nothing to degrade.
  const height = size === "lg" ? 52 : 48;
  const isDisabled = disabled || loading;

  const base: ViewStyle = {
    height,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
    maxWidth: "100%",
    opacity: isDisabled ? 0.55 : 1,
  };

  const label: TextStyle = {
    fontSize: size === "lg" ? typography.size.callout : typography.size.body,
    fontWeight: "600",
    letterSpacing: typography.tracking.body,
  };

  if (variant === "accent") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        style={({ pressed }) => [
          base,
          shadow.accent,
          { backgroundColor: pressed ? theme.accentHover : theme.accent },
          style,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={theme.inkInverse} />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[label, { color: theme.inkInverse }, textStyle]}
          >
            {title}
          </Text>
        )}
      </Pressable>
    );
  }

  if (variant === "ink") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        style={({ pressed }) => [
          base,
          { backgroundColor: pressed ? palette.ink700 : palette.black },
          style,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={theme.inkInverse} />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[label, { color: theme.inkInverse }, textStyle]}
          >
            {title}
          </Text>
        )}
      </Pressable>
    );
  }

  if (variant === "ghost") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        style={({ pressed }) => [
          base,
          { backgroundColor: pressed ? theme.glass2 : "transparent" },
          style,
        ]}
        {...rest}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[label, { color: theme.inkMuted }, textStyle]}
        >
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="button" disabled={isDisabled} style={[style]} {...rest}>
      {({ pressed }) => (
        <GlassSurface
          level={pressed ? "strong" : "base"}
          cornerRadius={radius.lg}
          style={base}
        >
          {loading ? (
            <ActivityIndicator color={theme.ink} />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[label, { color: theme.ink }, textStyle]}
            >
              {title}
            </Text>
          )}
        </GlassSurface>
      )}
    </Pressable>
  );
}

/** iOS Settings switch: 51×31 capsule, white thumb, system green. */
export function IosSwitch({
  value,
  disabled = false,
}: {
  value: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  // A lazy `useState` initializer, not a ref: this reads the instance during
  // render, and it also stops `new Animated.Value` from being constructed and
  // thrown away on every render the way the eager `useRef` argument was.
  const [progress] = React.useState(() => new Animated.Value(value ? 1 : 0));

  React.useEffect(() => {
    if (reducedMotion) {
      progress.setValue(value ? 1 : 0);
      return;
    }
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, [value, progress, reducedMotion]);

  const offTrack = theme.scheme === "dark" ? "#39393D" : "#E9E9EA";
  const onTrack = theme.scheme === "dark" ? "#30D158" : "#34C759";

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        padding: 2,
        justifyContent: "center",
        backgroundColor: offTrack,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 15.5,
            backgroundColor: onTrack,
            opacity: progress,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 15.5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.04)",
          },
        ]}
      />
      <Animated.View
        style={{
          width: 27,
          height: 27,
          borderRadius: 13.5,
          backgroundColor: "#FFFFFF",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 3,
          elevation: 3,
          zIndex: 2,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 20],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

export type GlassInputProps = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Hairline row inside a card instead of a nested glass field. */
  inset?: boolean;
  last?: boolean;
};

/** Frosted text field. Use `inset` inside a `GlassCard` so fields don't nest. */
export function GlassInput({
  label,
  containerStyle,
  style,
  multiline,
  inset = false,
  last = false,
  ...rest
}: GlassInputProps) {
  const theme = useAppTheme();
  const field = (
    <TextInput
      placeholderTextColor={theme.inkSubtle}
      keyboardAppearance={theme.scheme}
      selectionColor={theme.accent}
      cursorColor={theme.accent}
      multiline={multiline}
      style={[
        {
          paddingHorizontal: inset ? 0 : spacing.lg,
          paddingVertical: multiline ? spacing.md : inset ? 14 : 14,
          minHeight: multiline ? 88 : inset ? 48 : 50,
          fontSize: typography.size.body,
          color: theme.ink,
          textAlignVertical: multiline ? "top" : "center",
          width: "100%",
        },
        style,
      ]}
      {...rest}
    />
  );

  return (
    <View
      style={[
        {
          marginBottom: inset ? 0 : spacing.md,
          minWidth: 0,
          flexShrink: 1,
          borderBottomWidth: inset && !last ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: theme.hairlineStrong,
        },
        containerStyle,
      ]}
    >
      {label ? <GlassLabel>{label}</GlassLabel> : null}
      {inset ? (
        field
      ) : (
        <GlassSurface level="strong" cornerRadius={radius.md}>
          {field}
        </GlassSurface>
      )}
    </View>
  );
}

export function GlassLabel({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        fontSize: typography.size.footnote,
        fontWeight: "600",
        color: theme.inkMuted,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

/** Selectable pill used for categories, radius and expiry choices. */
export function GlassChip({
  label,
  selected = false,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 400;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        {
          paddingHorizontal: compact ? 12 : 14,
          paddingVertical: 8,
          minHeight: 36,
          flexShrink: 0,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected ? theme.ink : theme.hairlineStrong,
          backgroundColor: selected ? theme.ink : "transparent",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: typography.size.footnote,
          fontWeight: "600",
          color: selected ? theme.inkInverse : theme.inkMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const STATUS_LABEL: Record<StatusTone, string> = {
  inStock: "In stock",
  canOrder: "Can order",
  outOfStock: "Out of stock",
  pending: "Waiting",
};

/** Maps the database `response_type` onto a design tone. */
export function toneForResponse(type: string | null | undefined): StatusTone {
  switch (type) {
    case "in_stock":
      return "inStock";
    case "can_order":
      return "canOrder";
    case "out_of_stock":
      return "outOfStock";
    default:
      return "pending";
  }
}

/** High-contrast answer pill: In Stock / Can Order / Out of Stock / Waiting. */
export function StatusPill({
  tone,
  label,
  style,
}: {
  tone: StatusTone;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const tonePalette = theme.status[tone];
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: spacing.md,
          paddingVertical: 5,
          borderRadius: radius.pill,
          backgroundColor: tonePalette.tint,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tonePalette.border,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: typography.size.caption,
          fontWeight: "600",
          color: tonePalette.ink,
        }}
      >
        {label ?? STATUS_LABEL[tone]}
      </Text>
    </View>
  );
}

/** Coloured rail down the leading edge of a response card. */
export function StatusRail({ tone }: { tone: StatusTone }) {
  const theme = useAppTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: theme.status[tone].solid,
      }}
    />
  );
}

/** Frosted bottom sheet. Rendered inline — pair with RN `Modal` when needed. */
export function GlassSheet({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <GlassSurface
      level="chrome"
      cornerRadius={radius.xxl}
      style={[
        {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
        },
        style,
      ]}
    >
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: radius.pill,
          backgroundColor: theme.hairlineStrong,
          marginBottom: spacing.lg,
        }}
      />
      <Text
        style={{
          fontSize: typography.size.title3,
          fontWeight: "700",
          color: theme.ink,
          letterSpacing: typography.tracking.title,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            marginTop: spacing.xs,
            fontSize: typography.size.footnote,
            color: theme.inkMuted,
            lineHeight: 19,
          }}
        >
          {description}
        </Text>
      ) : null}
      <View style={{ marginTop: spacing.lg }}>{children}</View>
    </GlassSurface>
  );
}

/**
 * Background component for `expo-router` `Tabs` — pass via `tabBarBackground`.
 * Set `edge="bottom"` to reuse it as a header background, where the hairline
 * belongs on the edge facing the content.
 */
export function GlassChromeBackground({
  edge = "top",
  blurTarget,
}: {
  edge?: "top" | "bottom";
  blurTarget?: BlurTargetRef;
}) {
  const theme = useAppTheme();
  const reduced = useReducedTransparency();
  if (reduced) {
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.solidChrome }]}
      />
    );
  }

  const flat = isFlatFallback(blurTarget);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={blur.chrome}
        tint={Platform.OS === "ios" ? iosChromeTint(theme.scheme) : theme.scheme}
        style={StyleSheet.absoluteFill}
        {...androidBlurProps(blurTarget)}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: flat ? theme.flatFill.chrome : theme.glassChrome,
          },
        ]}
      />
      <View
        style={{
          position: "absolute",
          [edge]: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.hairlineStrong,
        }}
      />
    </View>
  );
}

/** Tab bar background: hairline on the top edge. */
export function GlassTabBarBackground({
  blurTarget,
}: {
  blurTarget?: BlurTargetRef;
} = {}) {
  return <GlassChromeBackground edge="top" blurTarget={blurTarget} />;
}

/** Header background: hairline on the bottom edge. */
export function GlassHeaderBackground({
  blurTarget,
}: {
  blurTarget?: BlurTargetRef;
} = {}) {
  return <GlassChromeBackground edge="bottom" blurTarget={blurTarget} />;
}

/** Empty / zero-state placeholder with a dashed glass outline. */
export function GlassEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 56,
        paddingHorizontal: spacing.xl,
      }}
    >
      <Text
        style={{
          fontSize: typography.size.body,
          fontWeight: "500",
          color: theme.inkMuted,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            marginTop: spacing.sm,
            fontSize: typography.size.footnote,
            color: theme.inkMuted,
            textAlign: "center",
            lineHeight: 19,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xl }}>{action}</View> : null}
    </View>
  );
}

/** Inline error / notice banner tinted with the brand red. */
export function GlassNotice({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted";
}) {
  const theme = useAppTheme();
  const isAccent = tone === "accent";
  return (
    <View
      style={{
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: isAccent ? theme.accentSoft : theme.glass1,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isAccent ? theme.accentRing : theme.hairlineStrong,
      }}
    >
      <Text
        style={{
          fontSize: typography.size.footnote,
          color: isAccent ? theme.accentInk : theme.inkMuted,
          lineHeight: 19,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Shared screen title block. Shrinks on narrow phones so headlines wrap cleanly. */
export function ScreenTitle({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      <Text
        numberOfLines={2}
        style={{
          fontSize: typography.size.title2,
          fontWeight: "700",
          color: theme.ink,
          letterSpacing: typography.tracking.title,
          lineHeight: 30,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={2}
          style={{
            marginTop: 6,
            fontSize: typography.size.footnote,
            color: theme.inkMuted,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function useNavigationOptions() {
  const theme = useAppTheme();
  return {
    tabBarActiveTintColor: theme.accent as ColorValue,
    tabBarInactiveTintColor: theme.inkSubtle as ColorValue,
    headerTintColor: theme.ink as ColorValue,
    headerTitleStyle: { fontWeight: "600" as const, color: theme.ink },
  };
}

/** Tab bar / header colour options shared by both apps. */
export const navigationOptions = {
  tabBarActiveTintColor: lightTheme.accent as ColorValue,
  tabBarInactiveTintColor: lightTheme.inkSubtle as ColorValue,
  headerTintColor: lightTheme.ink as ColorValue,
  headerTitleStyle: { fontWeight: "600" as const, color: lightTheme.ink },
};
