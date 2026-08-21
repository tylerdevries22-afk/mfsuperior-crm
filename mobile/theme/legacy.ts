import { Appearance, Platform, type ViewStyle } from "react-native";

import { DARK_THEME, LIGHT_THEME, type ThemePalette } from "./palette";
import { FONTS } from "./tokens";

/**
 * Compatibility tokens ported from Appliance Diagnostic Systems at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 *
 * These values deliberately preserve the reference app's legacy geometry
 * while its screens move to the role-based tokens in `tokens.ts`. New code
 * should prefer `useTheme`, `SPACE`, `RADIUS`, and `TYPO`.
 */

/** @deprecated Static at module load. Prefer `useTheme()`. */
export const THEME: ThemePalette =
  Appearance.getColorScheme() === "light" ? LIGHT_THEME : DARK_THEME;

/** @deprecated Prefer `SPACE`. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** @deprecated Prefer `RADIUS` or `RADIUS_DENSE`. */
export const RADIUS_LEGACY = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
  full: 999,
} as const;

/** @deprecated Prefer the role-based `TYPO` scale. */
export const TYPO_LEGACY = {
  hero: { fontFamily: FONTS.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.3 },
  h1: { fontFamily: FONTS.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
  h2: { fontFamily: FONTS.bold, fontSize: 20, lineHeight: 28, letterSpacing: 0 },
  h3: { fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 24, letterSpacing: 0.1 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  button: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 22, letterSpacing: 0.2 },
} as const;

/** @deprecated Prefer `shadowCard(theme)`. */
export const CARD_SHADOW: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: THEME.shadow.color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
    default: {},
  }) ?? {};

/** @deprecated Prefer `shadowCard(theme)`. */
export const CARD_SHADOW_SM: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: THEME.shadow.color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    default: {},
  }) ?? {};

/** @deprecated Prefer `MOTION`. */
export const ANIM = {
  spring: { damping: 18, stiffness: 200, mass: 0.8 },
  springSnappy: { damping: 22, stiffness: 300, mass: 0.6 },
  duration: { fast: 150, normal: 250, slow: 400 },
  pressScale: 0.97,
} as const;
