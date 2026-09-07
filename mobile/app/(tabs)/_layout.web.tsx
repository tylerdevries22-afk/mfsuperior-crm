import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Redirect, Tabs, useSegments } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import { useOperations } from "@/store";
import {
  HAIRLINE,
  MATERIAL_INTENSITY,
  materialTint,
  materialWash,
  TYPO,
  useTheme,
} from "@/theme";

export default function WebTabLayout() {
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const segments = useSegments();
  const currentTab = (segments as readonly string[])[1];
  const staff = effectiveRole === "admin" || effectiveRole === "driver";
  const customer = effectiveRole === "customer";
  const admin = effectiveRole === "admin";
  const blocked = (customer && ["schedule", "assistant", "hq", "fleet"].includes(currentTab ?? ""))
    || (staff && ["shipments", "requests"].includes(currentTab ?? ""))
    || (currentTab === "fleet" && !admin);
  if (blocked) return <Redirect href="/(tabs)" />;

  const tabs: readonly [string, string, ComponentProps<typeof Feather>["name"], boolean][] = [
    ["index", "Home", "home", true],
    ["schedule", "Schedule", "calendar", staff],
    ["assistant", "Assistant", "message-circle", false],
    ["fleet", "Fleet", "truck", admin],
    ["hq", "HQ", "map", staff],
    ["shipments", "Shipments", "truck", customer],
    ["requests", "Requests", "file-text", customer],
    ["profile", "Profile", "user", true],
  ];

  // Five admin destinations must fit on small phones without hiding Profile.
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: theme.primaryLight,
    tabBarInactiveTintColor: theme.textMuted,
    /**
     * Chrome material behind the bar, matching the native `NativeTabs`
     * `systemChromeMaterial` effect the iOS build already uses.
     */
    tabBarBackground: () => (
      <BlurView
        intensity={MATERIAL_INTENSITY.chrome}
        style={[StyleSheet.absoluteFill, { backgroundColor: materialWash(theme, "chrome") }]}
        tint={materialTint(theme.mode, "chrome")}
      />
    ),
    tabBarStyle: {
      backgroundColor: "transparent",
      borderTopColor: theme.separator,
      borderTopWidth: HAIRLINE,
      height: 60,
      paddingBottom: 6,
    },
    tabBarLabelStyle: { ...TYPO.subtitle, fontSize: 11 },
    tabBarItemStyle: { minWidth: 0 },
  }}>
    {tabs.map(([name, title, icon, visible]) => <Tabs.Screen key={name} name={name} options={{
      title,
      href: visible ? undefined : null,
      tabBarIcon: ({ color, size }) => <Feather name={icon} color={color} size={size} />,
    }} />)}
  </Tabs>;
}
