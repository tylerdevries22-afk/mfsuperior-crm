import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { DARK_THEME, LIGHT_THEME, type ThemeMode, type ThemePalette } from "./palette";
import { useTheme } from "./ThemeProvider";

type NamedStyles<T> = { [Property in keyof T]: ViewStyle | TextStyle | ImageStyle };

/** Build both theme variants once, then select the active one at render time. */
export function makeThemed<T>(build: (theme: ThemePalette) => T): () => T {
  const values: Record<ThemeMode, T> = {
    light: build(LIGHT_THEME),
    dark: build(DARK_THEME),
  };

  return function useThemed(): T {
    const { mode } = useTheme();
    return values[mode];
  };
}

/** Create a StyleSheet whose values follow automatic light and dark appearance. */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<never>>(
  build: (theme: ThemePalette) => T,
): () => T {
  return makeThemed((theme) => StyleSheet.create(build(theme)));
}
