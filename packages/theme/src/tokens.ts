/**
 * FINDIT design tokens — the single source of truth for the "clear glass" system.
 *
 * Consumed directly by the React Native apps. The web mirrors these values as CSS
 * custom properties in `src/app/globals.css`; `src/__tests__/theme-tokens.test.ts`
 * asserts the two stay in sync, so change hex values here first.
 */

/** Brand palette. Black and white carry structure; red is the action colour. */
export const palette = {
  black: "#0B0B0C",
  white: "#FFFFFF",

  /** Action / accent. 500 is the primary fill, 600 is the accessible text tone. */
  red50: "#FFF1F0",
  red100: "#FFDEDB",
  red300: "#FF8078",
  red400: "#FF4A3D",
  red500: "#E5231B",
  red600: "#C81109",
  red700: "#A00D07",

  /** Neutral "ink" ramp, very slightly cool so it reads as glass rather than grey. */
  ink50: "#F7F7F8",
  ink100: "#EFEFF1",
  ink200: "#E2E2E6",
  ink300: "#C9C9CF",
  ink400: "#9A9AA3",
  ink500: "#6E6E78",
  ink600: "#4A4A52",
  ink700: "#2E2E34",
  ink800: "#1A1A1E",
  ink900: "#0B0B0C",
} as const;

/**
 * Semantic response colours.
 *
 * Deliberately *not* brand red: red means "action" everywhere else in the product,
 * and "Out of Stock" is a valid answer rather than an error. Each entry pairs a
 * saturated `solid` (fills, accent rails) with a darker `ink` that clears 4.5:1 on
 * light glass, plus a translucent `tint` for the pill background.
 */
export const status = {
  inStock: {
    solid: "#0E9F6E",
    ink: "#07704D",
    tint: "rgba(14, 159, 110, 0.14)",
    border: "rgba(14, 159, 110, 0.30)",
  },
  canOrder: {
    solid: "#C77700",
    ink: "#8A5300",
    tint: "rgba(199, 119, 0, 0.14)",
    border: "rgba(199, 119, 0, 0.30)",
  },
  outOfStock: {
    solid: "#9A9AA3",
    ink: "#4A4A52",
    tint: "rgba(110, 110, 120, 0.12)",
    border: "rgba(110, 110, 120, 0.26)",
  },
  pending: {
    solid: "#9A9AA3",
    ink: "#4A4A52",
    tint: "rgba(110, 110, 120, 0.10)",
    border: "rgba(110, 110, 120, 0.22)",
  },
} as const;

export type StatusTone = keyof typeof status;

/** Semantic surface + text roles. Everything visual should reference these. */
export const theme = {
  /** Base canvas sitting behind the glass; the mesh tints below sit on top of it. */
  canvas: "#F4F4F6",
  canvasDeep: "#E8E8EC",

  /** Layered translucency. 1 = faintest, 3 = most opaque / most "solid" glass. */
  glass1: "rgba(255, 255, 255, 0.44)",
  glass2: "rgba(255, 255, 255, 0.62)",
  glass3: "rgba(255, 255, 255, 0.78)",
  /** Chrome (nav bars, tab bars) needs a touch more opacity to stay legible. */
  glassChrome: "rgba(255, 255, 255, 0.72)",
  /** Dark glass, used sparingly for inverted panels and the landing hero. */
  glassDark: "rgba(11, 11, 12, 0.58)",

  /** Hairline borders and the inner top highlight that sells the glass edge. */
  hairline: "rgba(255, 255, 255, 0.55)",
  hairlineStrong: "rgba(11, 11, 12, 0.10)",
  highlight: "rgba(255, 255, 255, 0.85)",

  /** Opaque equivalents for reduced-transparency / no-blur fallbacks. */
  solid1: "#FBFBFC",
  solid2: "#FFFFFF",
  solid3: "#FFFFFF",
  solidChrome: "#FFFFFF",

  ink: palette.ink900,
  inkMuted: palette.ink500,
  inkSubtle: palette.ink400,
  inkInverse: palette.white,

  accent: palette.red500,
  accentHover: palette.red600,
  accentInk: palette.red600,
  accentSoft: "rgba(229, 35, 27, 0.12)",
  accentRing: "rgba(229, 35, 27, 0.38)",
  accentGlow: "rgba(229, 35, 27, 0.28)",
} as const;

/** Blur intensities, in px for CSS and as `expo-blur` intensity for native. */
export const blur = {
  subtle: 12,
  base: 24,
  strong: 40,
  chrome: 30,
} as const;

/** Saturation boost applied alongside blur — what makes it read as glass, not fog. */
export const saturate = 180;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 34,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  /**
   * Web-only stack; Geist is loaded on web and sits in front of the system fonts.
   * React Native omits `fontFamily` entirely so it inherits San Francisco / Roboto.
   */
  family:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif',
  size: {
    caption: 12,
    footnote: 13,
    body: 15,
    callout: 17,
    title3: 20,
    title2: 24,
    title1: 30,
    hero: 38,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
  },
  /** Apple-style optical tightening: the larger the type, the tighter the tracking. */
  tracking: {
    hero: -1.1,
    title: -0.5,
    body: 0,
    caption: 0.2,
    overline: 1.4,
  },
} as const;

/** Native shadow presets (iOS values; `elevation` covers Android). */
export const shadow = {
  card: {
    shadowColor: "#0B0B0C",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  chrome: {
    shadowColor: "#0B0B0C",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  accent: {
    shadowColor: palette.red500,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const tokens = {
  palette,
  status,
  theme,
  blur,
  saturate,
  radius,
  spacing,
  typography,
  shadow,
} as const;

export default tokens;
