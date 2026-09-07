import type { BlurTint } from "expo-blur";
import { Platform, type ViewStyle } from "react-native";

import { alpha } from "./alpha";
import type { ThemeMode, ThemePalette } from "./palette";

/**
 * Apple-style material levels. Each maps to a UIBlurEffect on iOS and to an
 * equivalent backdrop blur elsewhere, so one token drives every glass surface.
 */
export type MaterialLevel = "ultraThin" | "thin" | "regular" | "thick" | "chrome";

/** expo-blur intensity per level, tuned to read as Apple's material stack. */
export const MATERIAL_INTENSITY: Readonly<Record<MaterialLevel, number>> = {
  ultraThin: 22,
  thin: 40,
  regular: 58,
  thick: 78,
  chrome: 68,
} as const;

/** iOS system material names; other platforms fall back to a plain tint. */
const IOS_MATERIAL: Readonly<Record<MaterialLevel, Record<ThemeMode, BlurTint>>> = {
  ultraThin: { light: "systemUltraThinMaterialLight", dark: "systemUltraThinMaterialDark" },
  thin: { light: "systemThinMaterialLight", dark: "systemThinMaterialDark" },
  regular: { light: "systemMaterialLight", dark: "systemMaterialDark" },
  thick: { light: "systemThickMaterialLight", dark: "systemThickMaterialDark" },
  chrome: { light: "systemChromeMaterialLight", dark: "systemChromeMaterialDark" },
} as const;

/**
 * Blur tint for a level. iOS gets the real system material so the surface
 * picks up Apple's vibrancy and scroll-edge behaviour.
 */
export function materialTint(mode: ThemeMode, level: MaterialLevel): BlurTint {
  if (Platform.OS === "ios") return IOS_MATERIAL[level][mode];
  return mode === "dark" ? "dark" : "light";
}

/**
 * Translucent wash painted under the blur. Android has no backdrop sampling and
 * web blur is cheap but weak, so both lean on a slightly heavier wash.
 */
export function materialWash(theme: ThemePalette, level: MaterialLevel): string {
  const base = theme.mode === "dark" ? theme.surfaceElevated : theme.surface;
  if (Platform.OS === "ios") return alpha(base, level === "ultraThin" ? 0.18 : 0.3);
  if (Platform.OS === "android") return alpha(base, 0.94);
  return alpha(base, level === "ultraThin" ? 0.62 : 0.76);
}

/** Apple's hairline separator width, resolution-independent. */
export const HAIRLINE = Platform.select({ ios: 0.33, android: 0.5, default: 1 }) as number;

/**
 * Liquid-glass edge refraction: a bright hairline that catches light the way a
 * real glass edge does. Dark surfaces need far less of it to read correctly.
 */
export function refractionBorder(theme: ThemePalette): ViewStyle {
  return {
    borderWidth: HAIRLINE,
    borderColor: theme.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.62)",
  };
}

/** Specular highlight drawn just inside the top edge of a glass surface. */
export function specularHighlight(theme: ThemePalette): ViewStyle {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HAIRLINE,
    backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.85)",
  };
}

/** Ambient shadow cast by a floating glass surface. */
export function materialShadow(theme: ThemePalette): ViewStyle {
  if (theme.mode === "dark") return {};
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: theme.shadow.color,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 28,
      },
      android: { elevation: 6 },
      default: {},
    }) ?? {}
  );
}
