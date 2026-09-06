import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DriverAvatar } from "@/components/operations/DriverAvatar";
import { AnimatedPressable, Card, ListRow, StatusBadge } from "@/components/ui";
import type { AppRole } from "@/domain/types";
import { useOperations } from "@/store";
import { TYPO, useTheme } from "@/theme";

const ROLES: readonly AppRole[] = ["customer", "driver", "admin"];

export function AccountPanel() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, currentAccount, effectiveRole, state, isDemo } = useOperations();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const canSwitch = isDemo && currentAccount?.role === "admin";
  const name = currentAccount?.displayName ?? "MF Superior user";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const driver = state.drivers.find((item) => item.id === currentAccount?.driverId);
  const switchRole = async (role: AppRole) => {
    setBusy(true);
    const changed = await actions.switchDemoRole(role);
    setBusy(false);
    if (changed) setExpanded(false);
  };
  return <Card padding="none">
    <AnimatedPressable accessibilityLabel={`${name}, ${effectiveRole ?? "account"}, account menu`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.account}>
      {driver ? <DriverAvatar driver={driver} ring={false} size={40} /> : <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={[styles.initials, { color: theme.primaryForeground }]}>{initials}</Text></View>}
      <View style={styles.copy}>
        <View style={styles.identity}><Text style={[styles.name, { color: theme.text }]}>{name}</Text><StatusBadge status={effectiveRole ?? "pending"} /></View>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{currentAccount?.title ?? "Freight operations"}</Text>
      </View>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} />
    </AnimatedPressable>
    {expanded ? <View style={[styles.menu, { borderTopColor: theme.border }]}>
      {canSwitch ? <View role="radiogroup" accessibilityLabel="Demo workspace role">
        {ROLES.map((role) => <AnimatedPressable accessibilityLabel={`Switch to ${role}`} accessibilityRole="radio" accessibilityState={{ checked: effectiveRole === role, disabled: busy }} disabled={busy} key={role} onPress={() => void switchRole(role)} style={styles.option}>
          <Text style={[styles.optionText, { color: theme.text }]}>{role}</Text>
          {effectiveRole === role ? <Feather name="check" size={18} color={theme.primaryLight} /> : null}
        </AnimatedPressable>)}
      </View> : null}
      <ListRow compact isLast onPress={() => router.push("/profile-details")} title="Account details" subtitle={currentAccount?.email ?? "Email unavailable"} />
    </View> : null}
  </Card>;
}
const styles = StyleSheet.create({
  account: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  initials: { ...TYPO.cardTitle },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  identity: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  name: { ...TYPO.cardTitle, flexShrink: 1 },
  meta: { ...TYPO.subtitle },
  menu: { borderTopWidth: 1 },
  option: { flexDirection: "row", minHeight: 44, alignItems: "center", paddingHorizontal: 14, gap: 8 },
  optionText: { ...TYPO.captionStrong, textTransform: "capitalize", flex: 1 },
});
