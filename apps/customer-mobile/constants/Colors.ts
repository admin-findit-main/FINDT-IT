import { theme } from '@findit/theme';

/**
 * The app renders the light "clear glass" system only, so both schemes resolve to
 * the same tokens rather than flipping to a dark palette.
 */
const glass = {
  text: theme.ink,
  background: theme.canvas,
  tint: theme.accent,
  tabIconDefault: theme.inkSubtle,
  tabIconSelected: theme.accent,
};

export default {
  light: glass,
  dark: glass,
};
