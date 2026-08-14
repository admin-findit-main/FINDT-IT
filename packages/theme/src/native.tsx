/**
 * Shared "clear glass" primitives for the FINDIT React Native apps.
 *
 * Every surface is a real `expo-blur` BlurView on iOS/Android. When the platform
 * can't blur, or the user has asked for reduced transparency, each primitive falls
 * back to an opaque surface of equivalent contrast rather than a washed-out tint.
 */
import { BlurTargetView, BlurView } from "expo-blur";
import * as React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { blur, radius, shadow, spacing, status, theme, typography } from "./tokens";
import type { StatusTone } from "./tokens";

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

const LEVEL_FILL: Record<GlassLevel, string> = {
  subtle: theme.glass1,
  base: theme.glass2,
  strong: theme.glass3,
  chrome: theme.glassChrome,
};

const LEVEL_SOLID: Record<GlassLevel, string> = {
  subtle: theme.solid1,
  base: theme.solid2,
  strong: theme.solid3,
  chrome: theme.solidChrome,
};

const LEVEL_INTENSITY: Record<GlassLevel, number> = {
  subtle: blur.subtle,
  base: blur.base,
  strong: blur.strong,
  chrome: blur.chrome,
};

/**
 * Fills used when the platform renders a flat translucent view instead of a real
 * blur (Android without a `blurTarget`). Without the blur there is nothing to
 * separate text from the content behind it, so these are noticeably more opaque.
 */
const LEVEL_FILL_FLAT: Record<GlassLevel, string> = {
  subtle: "rgba(255, 255, 255, 0.78)",
  base: "rgba(255, 255, 255, 0.88)",
  strong: "rgba(255, 255, 255, 0.94)",
  chrome: "rgba(255, 255, 255, 0.92)",
};

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
 * The base layered surface every other primitive builds on: a blurred fill, a
 * translucent wash to lift contrast, a hairline border, and an inner top highlight.
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
  const reduced = useReducedTransparency();
  const shape: ViewStyle = {
    borderRadius: cornerRadius,
    overflow: "hidden",
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: bordered ? theme.hairlineStrong : "transparent",
  };

  if (reduced) {
    return (
      <View
        style={[shape, { backgroundColor: LEVEL_SOLID[level] }, style]}
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
        tint={Platform.OS === "ios" ? "systemThinMaterialLight" : "light"}
        style={StyleSheet.absoluteFill}
        {...androidBlurProps(blurTarget)}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: flat ? LEVEL_FILL_FLAT[level] : LEVEL_FILL[level] },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: theme.highlight,
        }}
      />
      {children}
    </View>
  );
}

/** A floating glass card with the standard drop shadow. */
export function GlassCard({
  style,
  children,
  padded = true,
  ...rest
}: GlassSurfaceProps & { padded?: boolean }) {
  return (
    <View style={[shadow.card, { borderRadius: rest.cornerRadius ?? radius.xl }]}>
      <GlassSurface
        {...rest}
        style={[padded ? { padding: spacing.lg } : null, style]}
      >
        {children}
      </GlassSurface>
    </View>
  );
}

/**
 * Screen shell: the tinted canvas plus the soft red/black glows that give the
 * glass something worth refracting.
 */
export function GlassBackdrop({ children, style }: ViewProps) {
  return (
    <View style={[{ flex: 1, backgroundColor: theme.canvas }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: "absolute",
            top: -140,
            right: -110,
            width: 340,
            height: 340,
            borderRadius: 999,
            backgroundColor: theme.accentGlow,
            opacity: 0.5,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 180,
            left: -150,
            width: 320,
            height: 320,
            borderRadius: 999,
            backgroundColor: "rgba(11, 11, 12, 0.10)",
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -160,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: 999,
            backgroundColor: "rgba(229, 35, 27, 0.10)",
          }}
        />
      </View>
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
  // The `glass` variant delegates to GlassSurface, which handles reduced
  // transparency itself; the solid variants have nothing to degrade.
  const height = size === "lg" ? 56 : 48;
  const isDisabled = disabled || loading;

  const base: ViewStyle = {
    height,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
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
          <Text style={[label, { color: theme.inkInverse }, textStyle]}>{title}</Text>
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
          { backgroundColor: pressed ? "#2E2E34" : theme.ink },
          style,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={theme.inkInverse} />
        ) : (
          <Text style={[label, { color: theme.inkInverse }, textStyle]}>{title}</Text>
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
          { backgroundColor: pressed ? theme.accentSoft : "transparent" },
          style,
        ]}
        {...rest}
      >
        <Text style={[label, { color: theme.accentInk }, textStyle]}>{title}</Text>
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
            <Text style={[label, { color: theme.ink }, textStyle]}>{title}</Text>
          )}
        </GlassSurface>
      )}
    </Pressable>
  );
}

export type GlassInputProps = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Frosted text field with a floating label. */
export function GlassInput({
  label,
  containerStyle,
  style,
  multiline,
  ...rest
}: GlassInputProps) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <GlassLabel>{label}</GlassLabel> : null}
      <GlassSurface level="strong" cornerRadius={radius.md}>
        <TextInput
          placeholderTextColor={theme.inkSubtle}
          multiline={multiline}
          style={[
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: multiline ? spacing.md : 14,
              minHeight: multiline ? 96 : 50,
              fontSize: typography.size.body,
              color: theme.ink,
              textAlignVertical: multiline ? "top" : "center",
            },
            style,
          ]}
          {...rest}
        />
      </GlassSurface>
    </View>
  );
}

export function GlassLabel({ children }: { children: React.ReactNode }) {
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected ? theme.accent : theme.hairlineStrong,
          backgroundColor: selected ? theme.accent : theme.glass2,
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
  inStock: "IN STOCK",
  canOrder: "CAN ORDER",
  outOfStock: "OUT OF STOCK",
  pending: "WAITING",
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
  const palette = status[tone];
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: spacing.md,
          paddingVertical: 5,
          borderRadius: radius.pill,
          backgroundColor: palette.tint,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: typography.size.caption,
          fontWeight: "700",
          letterSpacing: typography.tracking.caption,
          color: palette.ink,
        }}
      >
        {label ?? STATUS_LABEL[tone]}
      </Text>
    </View>
  );
}

/** Coloured rail down the leading edge of a response card. */
export function StatusRail({ tone }: { tone: StatusTone }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: status[tone].solid,
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
        tint={Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
        style={StyleSheet.absoluteFill}
        {...androidBlurProps(blurTarget)}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: flat ? LEVEL_FILL_FLAT.chrome : theme.glassChrome,
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
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.hairlineStrong,
        backgroundColor: theme.glass1,
      }}
    >
      <Text
        style={{
          fontSize: typography.size.callout,
          fontWeight: "700",
          color: theme.ink,
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

/** Shared screen title block. */
export function ScreenTitle({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: spacing.xl }, style]}>
      <Text
        style={{
          fontSize: typography.size.title1,
          fontWeight: "800",
          color: theme.ink,
          letterSpacing: typography.tracking.hero,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: spacing.sm,
            fontSize: typography.size.body,
            color: theme.inkMuted,
            lineHeight: 21,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Tab bar / header colour options shared by both apps. */
export const navigationOptions = {
  tabBarActiveTintColor: theme.accent as ColorValue,
  tabBarInactiveTintColor: theme.inkSubtle as ColorValue,
  headerTintColor: theme.ink as ColorValue,
  headerTitleStyle: { fontWeight: "700" as const, color: theme.ink },
};
