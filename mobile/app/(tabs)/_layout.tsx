import { Redirect, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { ColorValue } from "react-native";

import { useOperations } from "@/store";
import { useTheme } from "@/theme";

const INTERNAL_TABS = new Set(["schedule", "assistant", "hq", "fleet"]);
const CUSTOMER_TABS = new Set(["shipments", "requests"]);

// Expo Router's public prop is typed as ColorValue even though the iOS native
// appearance accepts null. Null is required to preserve scroll-edge
// transparency, systemChromeMaterial, and iOS 26 Liquid Glass.
const SYSTEM_MATERIAL_BACKGROUND = null as unknown as ColorValue;

export default function TabLayout() {
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const segments = useSegments();
  const currentTab = (segments as readonly string[])[1];
  const isCustomer = effectiveRole === "customer";
  const isStaff = effectiveRole === "admin" || effectiveRole === "driver";
  const isAdmin = effectiveRole === "admin";

  const blocked = (isCustomer && INTERNAL_TABS.has(currentTab ?? ""))
    || (isStaff && CUSTOMER_TABS.has(currentTab ?? ""))
    || (currentTab === "fleet" && !isAdmin);
  if (blocked) return <Redirect href="/(tabs)" />;

  // Keep minimizeBehavior and disableTransparentOnScrollEdge unset so UIKit's
  // automatic iOS 26 behavior applies, matching the reference app.
  return (
    <NativeTabs
      blurEffect="systemChromeMaterial"
      backgroundColor={SYSTEM_MATERIAL_BACKGROUND}
      iconColor={{ default: theme.textMuted, selected: theme.primaryLight }}
      tintColor={theme.primaryLight}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          md="home"
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule" hidden={!isStaff}>
        <NativeTabs.Trigger.Icon md="calendar_month" sf="calendar" />
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="assistant" hidden>
        <NativeTabs.Trigger.Icon md="assistant" sf="sparkles" />
        <NativeTabs.Trigger.Label>Assistant</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="fleet" hidden={!isAdmin}>
        <NativeTabs.Trigger.Icon md="local_shipping" sf={{ default: "truck.box", selected: "truck.box.fill" }} />
        <NativeTabs.Trigger.Label>Fleet</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hq" hidden={!isStaff}>
        <NativeTabs.Trigger.Icon
          md="map"
          sf={{ default: "map", selected: "map.fill" }}
        />
        <NativeTabs.Trigger.Label>HQ</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shipments" hidden={!isCustomer}>
        <NativeTabs.Trigger.Icon
          md="local_shipping"
          sf={{ default: "truck.box", selected: "truck.box.fill" }}
        />
        <NativeTabs.Trigger.Label>Shipments</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests" hidden={!isCustomer}>
        <NativeTabs.Trigger.Icon md="assignment" sf="doc.text" />
        <NativeTabs.Trigger.Label>Requests</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          md="account_circle"
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
