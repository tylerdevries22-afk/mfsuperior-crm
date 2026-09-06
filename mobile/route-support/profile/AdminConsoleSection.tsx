import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PayoutRailMosaic } from "@/components/operations";
import { Card, ListRow, SectionHeader } from "@/components/ui";
import { useOperations } from "@/store";
import { TYPO, useTheme } from "@/theme";
import { useOperationBadges } from "./useOperationBadges";

const CONSOLES = [
  { icon: "truck", route: "/fleet", subtitle: "Units, trailers, and assignments", title: "Fleet", badge: "fleet", countLabel: "need attention" },
  { icon: "clipboard", route: "/jobs", subtitle: "Dispatch board for every load", title: "Jobs", badge: "jobs", countLabel: "active jobs" },
  { icon: "users", route: "/driver-scheduling", subtitle: "Availability against the week's work", title: "Driver scheduling" },
  { icon: "credit-card", route: "/payouts", subtitle: "Settlements and payment records", title: "Payouts & payments" },
  { icon: "tool", route: "/maintenance", subtitle: "Work orders and preventive service", title: "Repairs & maintenance", badge: "maintenance", countLabel: "open orders" },
  { icon: "file-text", route: "/licensing", subtitle: "Registration, inspections, and CDLs", title: "Licensing & registration", badge: "licensing", countLabel: "expired or due within 30 days" },
  { icon: "link", route: "/integrations", subtitle: "Carrier portals and EDI onboarding", title: "Integrations" },
] as const;

export function AdminConsoleSection() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const badges = useOperationBadges();
  if (effectiveRole !== "admin") return null;
  return <><SectionHeader title="Operations" /><Card padding="none">{CONSOLES.map((item, index) => {
    const count = "badge" in item ? badges[item.badge] : undefined;
    const countLabel = "countLabel" in item ? `${count} ${item.countLabel}` : "";
    return <ListRow compact accessibilityLabel={[item.title, countLabel, item.subtitle].filter(Boolean).join(", ")} isLast={index === CONSOLES.length - 1} key={item.route} leading={item.route === "/payouts" ? <PayoutRailMosaic /> : <Feather color={theme.primaryLight} name={item.icon} size={19} />} onPress={() => router.push(item.route)} subtitle={item.subtitle} title={item.title} trailing={<View style={styles.trailing}>
      {count !== undefined ? <View accessibilityLabel={countLabel} accessibilityLiveRegion="polite" style={[styles.counter, { backgroundColor: count > 0 ? theme.primaryMuted : theme.surfaceElevated }]}><Text style={[styles.count, { color: count > 0 ? theme.primaryLight : theme.textMuted }]}>{count > 99 ? "99+" : count}</Text></View> : null}
      <Feather color={theme.textMuted} name="chevron-right" size={16} />
    </View>} />;
  })}</Card></>;
}
const styles = StyleSheet.create({
  trailing: { flexDirection: "row", alignItems: "center", gap: 6 },
  counter: { minWidth: 24, minHeight: 24, paddingHorizontal: 6, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  count: { ...TYPO.captionStrong },
});
