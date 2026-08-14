import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import { spacing } from "@findit/theme";

/** Breakpoint the floor-terminal layouts share. */
export const TABLET_WIDTH = 768;

/**
 * The glass tab bar is absolutely positioned so content can drift under it, so
 * every tab scroll view has to reserve its height at the bottom. Mirrors the
 * heights set in `app/(app)/(tabs)/_layout.tsx`.
 */
export function useTabContentInset() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = width >= TABLET_WIDTH;
  const tabBarHeight = (tablet ? 64 : 49) + insets.bottom;
  return { tablet, tabBarHeight, paddingBottom: tabBarHeight + spacing.xl };
}
