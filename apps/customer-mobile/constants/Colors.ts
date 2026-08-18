import { darkTheme, lightTheme } from "@findit/theme";

export default {
  light: {
    text: lightTheme.ink,
    background: lightTheme.canvas,
    tint: lightTheme.accent,
    tabIconDefault: lightTheme.inkSubtle,
    tabIconSelected: lightTheme.accent,
  },
  dark: {
    text: darkTheme.ink,
    background: darkTheme.canvas,
    tint: darkTheme.accent,
    tabIconDefault: darkTheme.inkSubtle,
    tabIconSelected: darkTheme.accent,
  },
};
