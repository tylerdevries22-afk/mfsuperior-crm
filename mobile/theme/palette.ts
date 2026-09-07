import { ramp, type TintRamp } from "./alpha";

export type ThemeMode = "light" | "dark";

export type TintBase =
  | "primary"
  | "primaryLight"
  | "success"
  | "danger"
  | "warning"
  | "orange"
  | "info"
  | "textMuted";

export type ThemePalette = {
  mode: ThemeMode;
  primary: string;
  primaryForeground: string;
  primaryMuted: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceBright: string;
  border: string;
  borderLight: string;
  /** Hairline rule between rows and sections, translucent like iOS separators. */
  separator: string;
  /** Opaque separator for surfaces that cannot composite translucency. */
  separatorOpaque: string;
  /**
   * Apple's system fill ramp: neutral translucent washes for the backgrounds of
   * controls and chips, so they read against any surface without a fixed colour.
   */
  fill: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
  };
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  error: string;
  orange: string;
  info: string;
  infoMuted: string;
  cardBg: string;
  metallic: string;
  metallicDark: string;
  steel: string;
  gradient: { start: string; end: string };
  shadow: { color: string; opacity: number };
  overlay: string;
  tint: Readonly<Record<TintBase, TintRamp>>;
};

function withTints(base: Omit<ThemePalette, "tint">): ThemePalette {
  return {
    ...base,
    tint: {
      primary: ramp(base.primary),
      primaryLight: ramp(base.primaryLight),
      success: ramp(base.success),
      danger: ramp(base.danger),
      warning: ramp(base.warning),
      orange: ramp(base.orange),
      info: ramp(base.info),
      textMuted: ramp(base.textMuted),
    },
  };
}

/** MF Superior's automatic dark appearance. */
export const DARK_THEME: ThemePalette = withTints({
  mode: "dark",
  primary: "#D4E030",
  primaryForeground: "#11110D",
  primaryMuted: "#282C10",
  primaryLight: "#E8F060",
  primaryDark: "#AEB91D",
  accent: "#C3CF25",

  // Apple's grouped-background ladder: true black base, then the three
  // neutral greys that lift cards and controls off it.
  background: "#000000",
  surface: "#1C1C1E",
  surfaceElevated: "#2C2C2E",
  surfaceBright: "#3A3A3C",
  border: "#38383A",
  borderLight: "#48484A",
  separator: "rgba(84,84,88,0.60)",
  separatorOpaque: "#38383A",
  fill: {
    primary: "rgba(120,120,128,0.36)",
    secondary: "rgba(120,120,128,0.32)",
    tertiary: "rgba(118,118,128,0.24)",
    quaternary: "rgba(116,116,128,0.18)",
  },

  // Apple publishes secondary and tertiary labels as translucent whites that
  // fall below WCAG AA on our raised surfaces, so the hierarchy keeps Apple's
  // neutral hue at opacities that stay legible instead.
  text: "#FFFFFF",
  textSecondary: "#C7C7CC",
  textMuted: "#AEAEB2",
  textInverse: "#1C1C1E",

  success: "#30D158",
  successMuted: "#0E2E18",
  warning: "#FFD60A",
  warningMuted: "#33290A",
  danger: "#FF453A",
  dangerMuted: "#3A1210",
  error: "#FF453A",
  orange: "#FF9F0A",
  info: "#0A84FF",
  infoMuted: "#06142A",

  cardBg: "#1C1C1E",
  metallic: "#AEAEB2",
  metallicDark: "#8E8E93",
  steel: "#98989D",
  gradient: { start: "#000000", end: "#1C1C1E" },
  shadow: { color: "#000000", opacity: 0 },
  overlay: "rgba(0,0,0,0.60)",
});

/** MF Superior's automatic light appearance. */
export const LIGHT_THEME: ThemePalette = withTints({
  mode: "light",
  primary: "#D4E030",
  primaryForeground: "#11110D",
  primaryMuted: "#F2F5CF",
  primaryLight: "#5C6500",
  primaryDark: "#7B8500",
  accent: "#B5C01B",

  // systemGroupedBackground under secondarySystemGroupedBackground cards: the
  // page recedes to grey and the content sits on white, as in Settings.
  background: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceElevated: "#F2F2F7",
  surfaceBright: "#E5E5EA",
  border: "#D1D1D6",
  borderLight: "#C6C6C8",
  separator: "rgba(60,60,67,0.29)",
  separatorOpaque: "#C6C6C8",
  fill: {
    primary: "rgba(120,120,128,0.20)",
    secondary: "rgba(120,120,128,0.16)",
    tertiary: "rgba(118,118,128,0.12)",
    quaternary: "rgba(116,116,128,0.08)",
  },

  // Apple's label hue at opacities that clear WCAG AA on systemGray5, which
  // its own 60%/30% secondary and tertiary labels do not.
  text: "#000000",
  textSecondary: "#3C3C43",
  textMuted: "#5A5A5E",
  textInverse: "#FFFFFF",

  // Apple's increased-contrast system colours, which are the accessible
  // variants meant to carry text rather than only fills.
  // systemGreen's increased-contrast variant (#248A3D) reaches only 3.9:1 on
  // its own muted tint, so light mode carries it a step darker.
  success: "#1D7735",
  successMuted: "#E7F6EB",
  warning: "#8F6A00",
  warningMuted: "#FFF6DB",
  danger: "#D70015",
  dangerMuted: "#FFE9EA",
  error: "#D70015",
  orange: "#C93400",
  info: "#0040DD",
  infoMuted: "#E6EDFF",

  cardBg: "#FFFFFF",
  metallic: "#6C6C70",
  metallicDark: "#48484A",
  steel: "#636366",
  gradient: { start: "#F2F2F7", end: "#E5E5EA" },
  shadow: { color: "#000000", opacity: 0.08 },
  overlay: "rgba(0,0,0,0.40)",
});
