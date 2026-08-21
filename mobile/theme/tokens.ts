import { Platform, type ViewStyle } from "react-native";

import type { ThemePalette } from "./palette";

/** Appliance Diagnostic's exact spacing rhythm. */
export const SPACE = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Content-surface corner radii. */
export const RADIUS = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 } as const;

/** Compact record and nested-chip corner radii. */
export const RADIUS_DENSE = { sm: 6, md: 8, lg: 10, xl: 12 } as const;

export const FONTS = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
} as const;

/** Role-based type scale shared by every screen. */
export const TYPO = {
  screenTitle: { fontFamily: FONTS.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.4 },
  largeTitle: { fontFamily: FONTS.bold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  section: { fontFamily: FONTS.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontFamily: FONTS.bold, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 22 },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 16, lineHeight: 21 },
  button: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 21, letterSpacing: 0.2 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 16 },
  eyebrow: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.3,
    textTransform: "uppercase" as const,
  },
  /** Compatibility role for compact uppercase actions. Prefer eyebrow for headings. */
  label: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  metricLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.45,
    textTransform: "uppercase" as const,
  },
  metric: { fontFamily: FONTS.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  metricLarge: { fontFamily: FONTS.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.2 },
  metricHero: { fontFamily: FONTS.bold, fontSize: 58, lineHeight: 62, letterSpacing: -1.8 },
} as const;

export const MOTION = {
  enterMs: 280,
  exitMs: 220,
  spring: { damping: 22, stiffness: 220 },
  springSnappy: { damping: 22, stiffness: 240 },
  pager: { damping: 22, stiffness: 240, mass: 0.85 },
  pressScale: 0.99,
} as const;

export const PRESSED = { opacity: 0.72, transform: [{ scale: MOTION.pressScale }] } as const;
export const PRESSED_TEXT = { opacity: 0.72 } as const;

export const SIZE = {
  button: { sm: 44, md: 48, lg: 56 },
  input: { default: 52, comfortable: 56 },
  row: { compact: 56, default: 78, rich: 112 },
  hit: 44,
} as const;

export const ICON = { xs: 14, sm: 16, md: 20, lg: 24, xl: 28 } as const;

/** The app's single, low-opacity card shadow. */
export function shadowCard(theme: ThemePalette): ViewStyle {
  if (theme.shadow.opacity === 0) return {};

  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: theme.shadow.color,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.shadow.opacity,
        shadowRadius: 24,
      },
      android: { elevation: 5 },
      default: {},
    }) ?? {}
  );
}
