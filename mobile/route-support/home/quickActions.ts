import type { Feather } from "@expo/vector-icons";
import type { Href } from "expo-router";

import { THEME } from "@/theme";

/** Mirrors the reference's `QUICK_ACTIONS` table, pointing at freight routes. */
export const QUICK_ACTIONS: readonly {
  readonly key: string;
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly color: string;
  readonly route: Href;
}[] = [
  { key: "hos", icon: "clock", label: "Duty Status", color: THEME.primary, route: "/hours-of-service" },
  { key: "toolbox", icon: "tool", label: "Toolbox", color: THEME.success, route: "/driver-toolbox" },
  { key: "exception", icon: "alert-triangle", label: "Report Issue", color: THEME.orange, route: "/exception-diagnostic" },
  { key: "location", icon: "map-pin", label: "Location", color: "#AF52DE", route: "/location-tracker" },
  { key: "messages", icon: "message-square", label: "Messages", color: THEME.primaryLight, route: "/messages" },
  { key: "history", icon: "clock", label: "History", color: THEME.textMuted, route: "/history" },
];
