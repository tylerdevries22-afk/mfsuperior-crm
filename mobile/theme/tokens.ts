import { Platform, type ViewStyle } from "react-native";

import type { ThemePalette } from "./palette";

/**
 * Apple's 8pt spacing grid, with 4 and 12 as the standard half-steps.
 *
 * Replaces the ported appliance app's 6/10 rhythm: HIG layout margins,
 * control padding, and stack spacing are all multiples of 4 off an 8pt base,
 * so off-grid values put every nested container a pixel or two out of line.
 */
export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Content-surface corner radii, tuned to Apple's continuous-curve scale.
 *
 * iOS concentric radii run roughly 10 (controls), 14 (cards), 20 (grouped
 * containers), 28 (sheets). The previous 12/18/26/34 set read noticeably
 * rounder than any system surface it sat next to.
 */
export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Compact record and nested-chip corner radii. */
export const RADIUS_DENSE = { sm: 6, md: 8, lg: 10, xl: 12 } as const;

export const FONTS = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
} as const;

/**
 * Role-based type scale, mapped onto Apple's SF text styles.
 *
 * Each role now lands on a real HIG style at its default (Large) Dynamic Type
 * size: LargeTitle 34/41, Title2 22/28, Title3 20/25, Headline and Body 17/22,
 * Callout 16/21, Footnote 13/18, Caption1 12/16, Caption2 11/13. Body moving
 * 15 -> 17 is the substantive change: 17pt is Apple's reading size, and the
 * ported 15pt made every screen read as secondary text.
 */
export const TYPO = {
  screenTitle: { fontFamily: FONTS.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.4 },
  largeTitle: { fontFamily: FONTS.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.4 },
  section: { fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.26 },
  heading: { fontFamily: FONTS.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  button: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  body: { fontFamily: FONTS.regular, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  bodyStrong: { fontFamily: FONTS.medium, fontSize: 17, lineHeight: 22, letterSpacing: -0.43 },
  callout: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 21, letterSpacing: -0.31 },
  subheadline: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.23 },
  caption: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  captionStrong: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 16 },
  eyebrow: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.5,
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
  /** Caption2 (11pt) is Apple's smallest legible size; this role was below it at 9pt. */
  metricLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.35,
    textTransform: "uppercase" as const,
  },
  metric: { fontFamily: FONTS.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  metricLarge: { fontFamily: FONTS.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.4 },
  metricHero: { fontFamily: FONTS.bold, fontSize: 56, lineHeight: 60, letterSpacing: -1.2 },
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
  // Apple's table cells: 44 plain, 58 subtitle, ~72 once a row carries a
  // stacked accessory. `rich` sat at 112, which padded every two-line row with
  // about 36pt of dead space that read as a gap rather than as breathing room.
  row: { compact: 56, default: 72, rich: 76 },
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
