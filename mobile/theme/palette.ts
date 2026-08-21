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

  background: "#0E0F0C",
  surface: "#171813",
  surfaceElevated: "#20211B",
  surfaceBright: "#292A23",
  border: "#303229",
  borderLight: "#414338",

  text: "#F5F6F0",
  textSecondary: "#C0C2B6",
  textMuted: "#9A9D91",
  textInverse: "#171813",

  success: "#63DB8A",
  successMuted: "#173322",
  warning: "#F7D04A",
  warningMuted: "#352F13",
  danger: "#FF8A84",
  dangerMuted: "#3B1D1A",
  error: "#FF8A84",
  orange: "#FFAE4A",
  info: "#94B2FF",
  infoMuted: "#1A2542",

  cardBg: "#171813",
  metallic: "#B7BCAF",
  metallicDark: "#747A6D",
  steel: "#6E7651",
  gradient: { start: "#0E0F0C", end: "#171813" },
  shadow: { color: "#000000", opacity: 0 },
  overlay: "rgba(14,15,12,0.78)",
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

  background: "#F7F7F2",
  surface: "#FFFFFF",
  surfaceElevated: "#F0F1E8",
  surfaceBright: "#E5E7DB",
  border: "#DDDED3",
  borderLight: "#CBCDC0",

  text: "#171813",
  textSecondary: "#50534B",
  textMuted: "#62665C",
  textInverse: "#FFFFFF",

  success: "#137333",
  successMuted: "#E3F7E8",
  warning: "#7A5900",
  warningMuted: "#FFF4C7",
  danger: "#A61B1B",
  dangerMuted: "#FDE8E7",
  error: "#A61B1B",
  orange: "#994900",
  info: "#1947A3",
  infoMuted: "#E7EEFF",

  cardBg: "#FFFFFF",
  metallic: "#62685D",
  metallicDark: "#50564B",
  steel: "#657035",
  gradient: { start: "#F7F7F2", end: "#ECEEE3" },
  shadow: { color: "#292B20", opacity: 0.08 },
  overlay: "rgba(23,24,19,0.32)",
});
