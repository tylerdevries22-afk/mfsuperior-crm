import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PayoutRailMosaic } from "@/components/operations";
import { AnimatedButton, Card, Header, ListRow, Screen, SectionHeader } from "@/components/ui";
import { AccountPanel } from "@/route-support/profile/AccountPanel";
import { AdminConsoleSection } from "@/route-support/profile/AdminConsoleSection";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

const APP_VERSION = (Constants.expoConfig?.version ?? "1.0.0") as string;

function DriverToolsSection() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  // Gated on effectiveRole rather than the account role, so an admin previewing
  // the driver experience actually sees the driver's own tools. Partner
  // integrations use the same effective-role boundary on their own screen.
  if (effectiveRole !== "driver") return null;
  return <><SectionHeader title="Driver tools" /><Card padding="none"><ListRow leading={<Feather color={theme.primaryLight} name="calendar" size={19} />} onPress={() => router.push("/availability")} subtitle="Set your days and block time" title="Availability" /><ListRow leading={<Feather color={theme.primaryLight} name="map" size={19} />} onPress={() => router.push("/trip-history")} subtitle="Delivered loads and what they earned" title="Trip history" /><ListRow isLast leading={<PayoutRailMosaic />} onPress={() => router.push("/driver-payments")} subtitle="Payout methods and settlements" title="Payments" /></Card></>;
}

function SettingsGroups() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const isStaff = effectiveRole === "admin" || effectiveRole === "driver";
  return <><SectionHeader title="Preferences" /><Card padding="none"><ListRow isLast leading={<Feather color={theme.primaryLight} name="shield" size={19} />} onPress={() => router.push("/profile-details")} subtitle="Password, MFA, and active sessions" title="Security" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /></Card><SectionHeader title="Support" /><Card padding="none">{isStaff ? <ListRow leading={<Feather color={theme.info} name="zap" size={19} />} onPress={() => router.push("/(tabs)/assistant")} subtitle="Ask about loads and freight operations" title="Assistant" /> : null}<ListRow leading={<Feather color={theme.info} name="book-open" size={19} />} onPress={() => router.push("/knowledge")} subtitle="Freight playbooks and guides" title="Knowledge" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /><ListRow isLast leading={<Feather color={theme.info} name="message-circle" size={19} />} onPress={() => router.push("/messages")} subtitle="Operations support" title="Messages" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /></Card></>;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { actions } = useOperations();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => { setSigningOut(true); await actions.signOut(); setSigningOut(false); };
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header subtitle="Account, security, and connections" title="Profile" /><Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}><AccountPanel /><DriverToolsSection /><AdminConsoleSection /><SettingsGroups /><AnimatedButton fullWidth loading={signingOut} onPress={() => void signOut()} title="Sign out" variant="outline" /><View style={styles.legalRow}><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://mfsuperiorproducts.com/privacy")}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Privacy Policy</Text></Pressable><Text style={[styles.legalDot, { color: theme.textMuted }]}>·</Text><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://mfsuperiorproducts.com/terms")}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Terms &amp; Conditions</Text></Pressable></View><Text style={[styles.footnote, { color: theme.textMuted }]}>MF Superior Products · Freight operations · v{APP_VERSION}</Text></Screen></View>;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  footnote: { ...TYPO.caption, paddingVertical: SPACE.md, textAlign: "center" },
  legalDot: { ...TYPO.caption },
  legalLink: { ...TYPO.caption, textDecorationLine: "underline" },
  legalRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs, justifyContent: "center" },
});
