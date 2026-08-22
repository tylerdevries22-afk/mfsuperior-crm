import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedButton, Card, Header, ListRow, Screen, SectionHeader, SegmentedControl, Sheet, StatusBadge } from "@/components/ui";
import type { AppRole } from "@/domain/types";
import { FREIGHT_PARTNERS, validatedPartnerPortal, type FreightPartnerDefinition } from "@/features/partner-integrations";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const APP_VERSION = (Constants.expoConfig?.version ?? "1.0.0") as string;

const ROLE_OPTIONS = [
  { label: "Customer", value: "customer" },
  { label: "Driver", value: "driver" },
  { label: "Admin", value: "admin" },
] as const;

function AccountPanel() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, effectiveRole, state } = useOperations();
  const initials = currentAccount?.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "MF";
  // A signed-in driver has a portrait; show it here rather than initials, so
  // the avatar matches the one the schedule and home screens render.
  const linkedDriver = state.drivers.find((driver) => driver.id === currentAccount?.driverId);
  return <Card><View style={styles.accountRow}>{linkedDriver ? <DriverAvatar driver={linkedDriver} ring={false} size={58} /> : <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={[styles.initials, { color: theme.primaryForeground }]}>{initials}</Text></View>}<View style={styles.grow}><Text style={[styles.accountName, { color: theme.text }]}>{currentAccount?.displayName ?? "MF Superior user"}</Text><Text style={[styles.accountMeta, { color: theme.textSecondary }]}>{currentAccount?.title ?? "Freight operations"}</Text><Text style={[styles.accountMeta, { color: theme.textMuted }]}>{currentAccount?.companyName ?? "MF Superior Products"}</Text></View><StatusBadge status={effectiveRole ?? "pending"} /></View><View style={[styles.divider, { backgroundColor: theme.border }]} /><ListRow isLast onPress={() => router.push("/profile-details")} subtitle={currentAccount?.email ?? "Email unavailable"} title="Account details" /></Card>;
}

function DemoRolePreview() {
  const theme = useTheme();
  const { actions, currentAccount, effectiveRole } = useOperations();
  const isDemoAdmin = currentAccount?.role === "admin" && currentAccount.email.includes("@demo.");
  if (!isDemoAdmin) return null;
  const switchRole = (role: AppRole) => { void actions.switchDemoRole(role); };
  return <><SectionHeader title="Demo workspace preview" /><Card variant="tinted"><View style={styles.demoTitleRow}><Feather color={theme.primaryLight} name="play-circle" size={19} /><Text style={[styles.cardTitle, { color: theme.text }]}>Demo only</Text></View><Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Preview another role without changing the signed-in admin demo account. Production users cannot switch roles.</Text><SegmentedControl accessibilityLabel="Preview demo role" onChange={switchRole} options={ROLE_OPTIONS} value={effectiveRole ?? "admin"} /></Card></>;
}

function PartnerSheet({ partner, onClose }: { readonly partner: FreightPartnerDefinition | null; readonly onClose: () => void }) {
  const theme = useTheme();
  if (!partner) return null;
  const openPortal = async () => { await Linking.openURL(validatedPartnerPortal(partner)); };
  return <Sheet footer={<AnimatedButton accessibilityLabel={`Open ${partner.name} portal`} fullWidth onPress={() => void openPortal()} title="Open Portal" />} onClose={onClose} title={partner.name} visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><View style={styles.sheetStatus}><StatusBadge status={partner.status === "portal_available" ? "onboarding" : "not configured"} /><Text style={[styles.statusLabel, { color: theme.text }]}>{partner.statusLabel}</Text></View><Text style={[styles.sheetSummary, { color: theme.textSecondary }]}>{partner.summary}</Text><View style={[styles.mfaNotice, { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium }]}><Feather color={theme.warning} name="lock" size={17} /><Text style={[styles.mfaText, { color: theme.text }]}>Admin TOTP MFA is required before setup, credentials, or sensitive carrier actions.</Text></View><Text style={[styles.sheetHeading, { color: theme.text }]}>Verified capability contract</Text>{partner.capabilities.map((capability) => <View key={capability} style={styles.bullet}><Feather color={theme.success} name="check" size={15} /><Text style={[styles.bulletText, { color: theme.textSecondary }]}>{capability}</Text></View>)}<Text style={[styles.sheetHeading, { color: theme.text }]}>Onboarding steps</Text>{partner.onboarding.map((step, index) => <View key={step} style={styles.bullet}><View style={[styles.stepNumber, { backgroundColor: theme.primaryMuted }]}><Text style={[styles.stepNumberText, { color: theme.primaryLight }]}>{index + 1}</Text></View><Text style={[styles.bulletText, { color: theme.textSecondary }]}>{step}</Text></View>)}<Text style={[styles.lastSync, { color: theme.textMuted }]}>Last sync: Never · No credentials configured · No live connection claimed</Text></ScrollView></Sheet>;
}

function IntegrationsSection() {
  const theme = useTheme();
  const [selected, setSelected] = useState<FreightPartnerDefinition | null>(null);
  return <><SectionHeader title="Integrations" /><Card padding="none">{FREIGHT_PARTNERS.map((partner, index) => <ListRow isLast={index === FREIGHT_PARTNERS.length - 1} key={partner.id} leading={<View style={[styles.integrationIcon, { backgroundColor: partner.status === "portal_available" ? theme.warningMuted : theme.surfaceElevated }]}><Feather color={partner.status === "portal_available" ? theme.warning : theme.textMuted} name={partner.id === "target" ? "target" : "link-2"} size={19} /></View>} onPress={() => setSelected(partner)} subtitle={partner.statusLabel} title={partner.name} trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} />)}</Card><PartnerSheet onClose={() => setSelected(null)} partner={selected} /></>;
}

function SettingsGroups() {
  const router = useRouter();
  const theme = useTheme();
  return <><SectionHeader title="Preferences" /><Card padding="none"><ListRow leading={<Feather color={theme.primaryLight} name="bell" size={19} />} subtitle="Push and email" title="Notifications" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /><ListRow isLast leading={<Feather color={theme.primaryLight} name="shield" size={19} />} onPress={() => router.push("/profile-details")} subtitle="Password, MFA, and active sessions" title="Security" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /></Card><SectionHeader title="Support" /><Card padding="none"><ListRow leading={<Feather color={theme.info} name="book-open" size={19} />} onPress={() => router.push("/knowledge")} subtitle="Freight playbooks and guides" title="Knowledge" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /><ListRow isLast leading={<Feather color={theme.info} name="message-circle" size={19} />} onPress={() => router.push("/messages")} subtitle="Operations support" title="Messages" trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />} /></Card></>;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { actions, currentAccount } = useOperations();
  const [signingOut, setSigningOut] = useState(false);
  const isDemo = useMemo(() => currentAccount?.email.includes("@demo.") ?? false, [currentAccount?.email]);
  const signOut = async () => { setSigningOut(true); await actions.signOut(); setSigningOut(false); };
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header subtitle="Account, security, and connections" title="Profile" /><Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}><AccountPanel />{isDemo ? <View style={[styles.demoBanner, { backgroundColor: theme.primaryMuted, borderColor: theme.tint.primary.medium }]}><Feather color={theme.primaryLight} name="play-circle" size={18} /><View style={styles.grow}><Text style={[styles.demoBannerTitle, { color: theme.text }]}>Demo workspace</Text><Text style={[styles.demoBannerCopy, { color: theme.textSecondary }]}>Records stay on this device and no partner portal is contacted.</Text></View></View> : null}<DemoRolePreview />{currentAccount?.role === "admin" ? <IntegrationsSection /> : null}<SettingsGroups /><AnimatedButton fullWidth loading={signingOut} onPress={() => void signOut()} title="Sign out" variant="outline" /><View style={styles.legalRow}><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://mfsuperiorproducts.com/privacy")}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Privacy Policy</Text></Pressable><Text style={[styles.legalDot, { color: theme.textMuted }]}>·</Text><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://mfsuperiorproducts.com/terms")}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Terms &amp; Conditions</Text></Pressable></View><Text style={[styles.footnote, { color: theme.textMuted }]}>MF Superior Products · Freight operations · v{APP_VERSION}</Text></Screen></View>;
}

const styles = StyleSheet.create({
  accountMeta: { ...TYPO.caption, marginTop: 2 },
  accountName: { ...TYPO.heading },
  accountRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  avatar: { alignItems: "center", borderRadius: RADIUS.lg, height: 58, justifyContent: "center", width: 58 },
  bullet: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  bulletText: { ...TYPO.caption, flex: 1 },
  cardCopy: { ...TYPO.body },
  cardTitle: { ...TYPO.cardTitle },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  demoBanner: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: 14 },
  demoBannerCopy: { ...TYPO.caption },
  demoBannerTitle: { ...TYPO.captionStrong },
  demoTitleRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  divider: { height: 1, marginTop: SPACE.md },
  fill: { flex: 1 },
  legalDot: { ...TYPO.caption },
  legalLink: { ...TYPO.caption, textDecorationLine: "underline" },
  legalRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs, justifyContent: "center" },
  footnote: { ...TYPO.caption, paddingVertical: SPACE.md, textAlign: "center" },
  grow: { flex: 1, minWidth: 0 },
  initials: { ...TYPO.heading },
  integrationIcon: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  lastSync: { ...TYPO.subtitle, lineHeight: 17, marginTop: SPACE.sm },
  mfaNotice: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: 12 },
  mfaText: { ...TYPO.caption, flex: 1 },
  sheetContent: { gap: SPACE.md, paddingBottom: SPACE.md },
  sheetHeading: { ...TYPO.cardTitle, marginTop: SPACE.sm },
  sheetStatus: { alignItems: "flex-start", gap: SPACE.sm },
  sheetSummary: { ...TYPO.body },
  statusLabel: { ...TYPO.captionStrong },
  stepNumber: { alignItems: "center", borderRadius: 12, height: 24, justifyContent: "center", width: 24 },
  stepNumberText: { ...TYPO.subtitle },
});
