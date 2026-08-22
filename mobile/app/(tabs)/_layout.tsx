import { Redirect, useSegments } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import type { ColorValue } from "react-native";

import { useOperations } from "@/store";
import { useTheme } from "@/theme";

const INTERNAL_TABS = new Set(["schedule", "assistant", "hq"]);
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

  const blocked = (isCustomer && INTERNAL_TABS.has(currentTab ?? ""))
    || (isStaff && CUSTOMER_TABS.has(currentTab ?? ""));
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
        <Icon
          drawable="home"
          sf={{ default: "house", selected: "house.fill" }}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule" hidden={!isStaff}>
        <Icon drawable="calendar_month" sf="calendar" />
        <Label>Schedule</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="assistant" hidden={!isStaff}>
        <Icon drawable="assistant" sf="sparkles" />
        <Label>Assistant</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hq" hidden={!isStaff}>
        <Icon
          drawable="map"
          sf={{ default: "map", selected: "map.fill" }}
        />
        <Label>HQ</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shipments" hidden={!isCustomer}>
        <Icon
          drawable="local_shipping"
          sf={{ default: "truck.box", selected: "truck.box.fill" }}
        />
        <Label>Shipments</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="requests" hidden={!isCustomer}>
        <Icon drawable="assignment" sf="doc.text" />
        <Label>Requests</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon
          drawable="account_circle"
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
