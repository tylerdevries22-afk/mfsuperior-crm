import { Redirect, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useOperations } from "@/store";
import { useTheme } from "@/theme";

const INTERNAL_TABS = new Set(["schedule", "assistant", "inventory"]);
const CUSTOMER_TABS = new Set(["shipments", "requests"]);

export default function TabLayout() {
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const segments = useSegments();
  const currentTab = (segments as readonly string[])[1];
  const isCustomer = effectiveRole === "customer";

  const blocked = (isCustomer && INTERNAL_TABS.has(currentTab ?? ""))
    || (!isCustomer && CUSTOMER_TABS.has(currentTab ?? ""));
  if (blocked) return <Redirect href="/(tabs)" />;

  return (
    <NativeTabs
      blurEffect="systemChromeMaterial"
      iconColor={theme.textMuted}
      tintColor={theme.primaryLight}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          md={{ default: "home", selected: "home_filled" }}
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule" hidden={isCustomer}>
        <NativeTabs.Trigger.Icon md="calendar_month" sf="calendar" />
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="assistant" hidden={isCustomer}>
        <NativeTabs.Trigger.Icon md="assistant" sf="sparkles" />
        <NativeTabs.Trigger.Label>Assistant</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inventory" hidden={isCustomer}>
        <NativeTabs.Trigger.Icon
          md={{ default: "inventory_2", selected: "inventory_2" }}
          sf={{ default: "shippingbox", selected: "shippingbox.fill" }}
        />
        <NativeTabs.Trigger.Label>Fleet</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shipments" hidden={!isCustomer}>
        <NativeTabs.Trigger.Icon
          md={{ default: "local_shipping", selected: "local_shipping" }}
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
          md={{ default: "account_circle", selected: "account_circle" }}
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
