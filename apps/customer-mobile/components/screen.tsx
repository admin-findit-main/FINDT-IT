import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@findit/theme";
import { GlassBackdrop } from "@findit/theme/native";

type ScreenVariant = "auth" | "tabs" | "stack";

/**
 * Phone-first shell: grouped canvas, keyboard avoidance, and safe-area padding.
 */
export function Screen({
  children,
  variant = "stack",
  scroll = true,
  extraBottom = 0,
  contentContainerStyle,
  style,
}: {
  children: ReactNode;
  variant?: ScreenVariant;
  scroll?: boolean;
  extraBottom?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const padX = spacing.lg;
  const top =
    variant === "auth"
      ? Math.max(insets.top, spacing.xl) + spacing.md
      : spacing.md;
  const bottom =
    (variant === "auth" || variant === "stack"
      ? Math.max(insets.bottom, spacing.lg)
      : spacing.lg) + extraBottom;

  const bodyStyle: ViewStyle = {
    flexGrow: 1,
    paddingHorizontal: padX,
    paddingTop: top,
    paddingBottom: bottom,
    ...(variant === "auth" ? { justifyContent: "flex-start" } : null),
  };

  const inner = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[bodyStyle, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, bodyStyle, contentContainerStyle]}>{children}</View>
  );

  return (
    <GlassBackdrop style={style}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={variant === "stack" ? 88 : 0}
      >
        {inner}
      </KeyboardAvoidingView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
