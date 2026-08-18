/**
 * FINDIT design tokens — source of truth for web and native.
 *
 * Web CSS in `src/app/globals.css` must stay in lockstep (`theme-tokens.test.ts`).
 * The product default is light: white surfaces, black type, cherry red for actions.
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

  /** Neutral ink ramp. */
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
export const statusDark = {
  inStock: {
    solid: "#30D158",
    ink: "#63E089",
    tint: "rgba(48, 209, 88, 0.18)",
    border: "rgba(48, 209, 88, 0.38)",
  },
  canOrder: {
    solid: "#FF9F0A",
    ink: "#FFD60A",
    tint: "rgba(255, 159, 10, 0.18)",
    border: "rgba(255, 159, 10, 0.38)",
  },
  outOfStock: {
    solid: "#8E8E93",
    ink: "#C7C7CC",
    tint: "rgba(142, 142, 147, 0.16)",
    border: "rgba(142, 142, 147, 0.32)",
  },
  pending: {
    solid: "#8E8E93",
    ink: "#C7C7CC",
    tint: "rgba(142, 142, 147, 0.12)",
    border: "rgba(142, 142, 147, 0.28)",
  },
} as const;

export const statusLight = {
  inStock: {
    solid: "#248A3D",
    ink: "#187A34",
    tint: "rgba(36, 138, 61, 0.12)",
    border: "rgba(36, 138, 61, 0.28)",
  },
  canOrder: {
    solid: "#C77B00",
    ink: "#9A5F00",
    tint: "rgba(199, 123, 0, 0.12)",
    border: "rgba(199, 123, 0, 0.28)",
  },
  outOfStock: {
    solid: "#8E8E93",
    ink: "#6E6E73",
    tint: "rgba(142, 142, 147, 0.12)",
    border: "rgba(142, 142, 147, 0.24)",
  },
  pending: {
    solid: "#8E8E93",
    ink: "#6E6E73",
    tint: "rgba(142, 142, 147, 0.10)",
    border: "rgba(142, 142, 147, 0.22)",
  },
} as const;

/** Web + default native: light, high-contrast response colours. */
export const status = statusLight;

export type StatusTone = keyof typeof status;
export type ColorSchemeName = "dark" | "light";

/** Semantic surface + text roles for dark mode. Web CSS stays in lockstep with this. */
export const darkTheme = {
  scheme: "dark" as const,
  status: statusDark,
  canvas: "#000000",
  canvasDeep: "#0B0B0C",
  glass1: "rgba(255, 255, 255, 0.06)",
  glass2: "rgba(255, 255, 255, 0.10)",
  glass3: "rgba(255, 255, 255, 0.16)",
  glassChrome: "rgba(18, 18, 20, 0.62)",
  glassDark: "rgba(11, 11, 12, 0.72)",
  hairline: "rgba(255, 255, 255, 0.18)",
  hairlineStrong: "rgba(255, 255, 255, 0.10)",
  highlight: "rgba(255, 255, 255, 0.22)",
  solid1: "#141416",
  solid2: "#1C1C1E",
  solid3: "#2C2C2E",
  solidChrome: "#1C1C1E",
  flatFill: {
    subtle: "rgba(28, 28, 30, 0.82)",
    base: "rgba(28, 28, 30, 0.90)",
    strong: "rgba(44, 44, 46, 0.94)",
    chrome: "rgba(22, 22, 24, 0.92)",
  },
  ink: "#F5F5F7",
  inkMuted: "#A1A1A6",
  inkSubtle: "#636366",
  inkInverse: palette.white,
  accent: palette.red500,
  accentHover: palette.red400,
  accentInk: palette.red300,
  accentSoft: "rgba(229, 35, 27, 0.16)",
  accentRing: "rgba(229, 35, 27, 0.40)",
  accentGlow: "rgba(229, 35, 27, 0.22)",
} as const;

/** Light counterpart: same cherry accent, inverted canvas and ink. */
export const lightTheme = {
  scheme: "light" as const,
  status: statusLight,
  canvas: "#F2F2F7",
  canvasDeep: "#FFFFFF",
  glass1: "rgba(255, 255, 255, 0.72)",
  glass2: "rgba(255, 255, 255, 0.86)",
  glass3: "rgba(255, 255, 255, 0.94)",
  glassChrome: "rgba(255, 255, 255, 0.78)",
  glassDark: "rgba(255, 255, 255, 0.92)",
  hairline: "rgba(0, 0, 0, 0.14)",
  hairlineStrong: "rgba(0, 0, 0, 0.08)",
  highlight: "rgba(255, 255, 255, 0.90)",
  solid1: "#FFFFFF",
  solid2: "#FFFFFF",
  solid3: "#E5E5EA",
  solidChrome: "#F9F9FB",
  flatFill: {
    subtle: "rgba(255, 255, 255, 0.88)",
    base: "rgba(255, 255, 255, 0.94)",
    strong: "rgba(255, 255, 255, 0.98)",
    chrome: "rgba(249, 249, 251, 0.94)",
  },
  ink: "#1C1C1E",
  inkMuted: "#6E6E73",
  inkSubtle: "#8E8E93",
  inkInverse: palette.white,
  accent: palette.red500,
  accentHover: palette.red600,
  accentInk: palette.red600,
  accentSoft: "rgba(229, 35, 27, 0.10)",
  accentRing: "rgba(229, 35, 27, 0.28)",
  accentGlow: "rgba(229, 35, 27, 0.10)",
} as const;

export type SemanticTheme = typeof darkTheme | typeof lightTheme;

export const schemes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

/** Default for web and first-run native. Dark is an explicit user choice. */
export const theme = lightTheme;

/** Blur intensities, in px for CSS and as `expo-blur` intensity for native. */
export const blur = {
  subtle: 12,
  base: 24,
  strong: 40,
  chrome: 30,
} as const;

/** Saturation boost applied alongside blur — what makes it read as glass, not fog. */
export const saturate = 200;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
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
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  chrome: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -1 },
    elevation: 4,
  },
  accent: {
    shadowColor: palette.red500,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

export const tokens = {
  palette,
  status,
  theme,
  darkTheme,
  lightTheme,
  schemes,
  blur,
  saturate,
  radius,
  spacing,
  typography,
  shadow,
} as const;

export default tokens;
