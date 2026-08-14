/**
 * Legacy Expo-template colour map, now sourced from the shared design tokens so
 * nothing in the app carries its own hex values. The app itself is light-only —
 * the `dark` entry exists solely to satisfy `useColorScheme` consumers.
 */
import { palette, theme } from "@findit/theme";

export default {
  light: {
    text: theme.ink,
    background: theme.canvas,
    tint: theme.accent,
    tabIconDefault: theme.inkSubtle,
    tabIconSelected: theme.accent,
  },
  dark: {
    text: theme.inkInverse,
    background: palette.ink900,
    tint: theme.accent,
    tabIconDefault: palette.ink400,
    tabIconSelected: theme.accent,
  },
};
