import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { DARK_THEME, LIGHT_THEME, type ThemeMode, type ThemePalette } from "./palette";

const ThemeContext = createContext<ThemePalette>(DARK_THEME);

export type ThemeProviderProps = {
  children: ReactNode;
  /** Intended for previews and tests. Production defaults to the system appearance. */
  mode?: ThemeMode | "system";
};

/** Provide a referentially stable, system-aware palette to the component tree. */
export function ThemeProvider({ children, mode = "system" }: ThemeProviderProps) {
  const systemMode = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const palette = resolvedMode === "light" ? LIGHT_THEME : DARK_THEME;

  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

/** Read the active light or dark palette. */
export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}
