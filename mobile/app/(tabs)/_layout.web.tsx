import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useSegments } from "expo-router";
import type { ComponentProps } from "react";

import { useOperations } from "@/store";
import { useTheme } from "@/theme";

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
    tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 68, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 11 },
    tabBarItemStyle: { minWidth: 0 },
  }}>
    {tabs.map(([name, title, icon, visible]) => <Tabs.Screen key={name} name={name} options={{
      title,
      href: visible ? undefined : null,
      tabBarIcon: ({ color, size }) => <Feather name={icon} color={color} size={size} />,
    }} />)}
  </Tabs>;
}
