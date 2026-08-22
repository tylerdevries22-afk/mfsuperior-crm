import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedPressable, FadeInView, Header, WorkspaceCard } from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { useOperations } from "@/store";
import { FONTS, RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

const customerArt = require("@/assets/freight/customer-hero-truck.webp") as ImageSourcePropType;
const capacityArt = require("@/assets/freight/capacity-warehouse.webp") as ImageSourcePropType;
const driverArt = require("@/assets/freight/driver-portrait.webp") as ImageSourcePropType;
const equipmentArt = require("@/assets/freight/equipment-categories.webp") as ImageSourcePropType;

interface HomeAction {
  readonly key: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly cta: string;
  readonly route: Href;
  readonly image: ImageSourcePropType;
}

const CUSTOMER_ACTIONS: readonly HomeAction[] = [
  { key: "request", eyebrow: "START HERE", title: "Request Freight", description: "Share the lane, freight, and timing that work for your business.", cta: "Start a request", route: "/(tabs)/requests", image: capacityArt },
  { key: "shipments", eyebrow: "IN MOTION", title: "Track Shipments", description: "Follow appointments, milestones, documents, and proof of delivery.", cta: "View shipments", route: "/(tabs)/shipments", image: customerArt },
  { key: "messages", eyebrow: "NEED HELP?", title: "Message Operations", description: "Reach the team that knows your freight and service history.", cta: "Open messages", route: "/messages", image: driverArt },
  { key: "profile", eyebrow: "ACCOUNT", title: "Profile & Settings", description: "Manage account details, security, and notification preferences.", cta: "Manage profile", route: "/(tabs)/profile", image: equipmentArt },
];

/**
 * Ported from the Appliance Diagnostic Systems `CustomerHome` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: the gradient hero, a "today at a
 * glance" panel, the section intro, the alternating featured-action rows, and
 * the closing note. The reference wraps its hero in `FadeInView`, so this does
 * too.
 */
export function CustomerHome() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, shipments } = useOperations();
  const name = currentAccount?.displayName.split(/\s+/)[0] ?? "there";
  const active = shipments.find((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header showLogo /><ScrollView contentContainerStyle={styles.customerScroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><FadeInView delay={0}><CustomerHero name={name} onRequest={() => router.push("/(tabs)/requests")} /></FadeInView>{active ? <CurrentShipment shipment={active} /> : null}<View style={styles.sectionIntro}><Text style={[styles.sectionPill, { backgroundColor: theme.primaryMuted, color: theme.primaryLight }]}>MF SUPERIOR FREIGHT</Text><Text style={[styles.customerSectionTitle, { color: theme.text }]}>Everything Your Freight Needs</Text><Text style={[styles.customerSectionDescription, { color: theme.textSecondary }]}>Service built around your lanes, your timing, and real help from a local team.</Text></View><View style={styles.featureList}>{CUSTOMER_ACTIONS.map((action, index) => <CustomerActionRow action={action} index={index} key={action.key} />)}</View><View style={styles.endNote}><Text style={[styles.endEyebrow, { color: theme.primaryLight }]}>OWNER OPERATED · DENVER, COLORADO</Text><Text style={[styles.endTitle, { color: theme.text }]}>Freight handled with clarity from pickup to final delivery.</Text></View></ScrollView></View>;
}

function CustomerHero({ name, onRequest }: { readonly name: string; readonly onRequest: () => void }) {
  const theme = useTheme();
  return <LinearGradient colors={["#171A12", "#0C0E0A"]} style={[styles.customerHero, { borderBottomColor: theme.border }]}><View accessibilityElementsHidden style={[styles.heroArtCircle, { backgroundColor: theme.surfaceBright, borderColor: theme.borderLight }]}><Image resizeMode="cover" source={customerArt} style={styles.heroArt} /></View><Text style={[styles.heroEyebrow, { color: theme.primaryLight }]}>WELCOME BACK, {name.toUpperCase()}</Text><Text style={[styles.customerHeroTitle, { color: theme.text }]}>Freight Delivery,{"\n"}<Text style={{ color: theme.primaryLight }}>Simplified.</Text></Text><Text style={[styles.customerHeroDescription, { color: theme.textSecondary }]}>Reliable freight capacity and local operations—without the runaround.</Text><AnimatedPressable accessibilityRole="button" haptic="selection" onPress={onRequest} style={[styles.customerHeroButton, { backgroundColor: theme.primary }]}><Text style={[styles.customerHeroButtonText, { color: theme.primaryForeground }]}>Request Freight</Text><Feather color={theme.primaryForeground} name="arrow-up-right" size={18} /></AnimatedPressable></LinearGradient>;
}

function CurrentShipment({ shipment }: { readonly shipment: Shipment }) {
  const router = useRouter();
  const theme = useTheme();
  const { state } = useOperations();
  const assignedDriver = state.drivers.find((driver) => driver.id === shipment.assignedDriverId);
  return <View style={styles.currentSection}><Text style={[styles.smallEyebrow, { color: theme.textMuted }]}>TODAY AT A GLANCE</Text><WorkspaceCard><View style={styles.shipmentTop}><View style={[styles.driverAvatar, { backgroundColor: theme.primaryMuted }]}>{assignedDriver ? <DriverAvatar driver={assignedDriver} ring={false} size={46} /> : <Image source={driverArt} style={styles.driverAvatarImage} />}</View><View style={styles.grow}><Text style={[styles.currentTitle, { color: theme.text }]}>Your shipment is {shipment.status.replaceAll("_", " ")}</Text><Text style={[styles.currentMeta, { color: theme.textSecondary }]}>{shipment.loadNumber} · {shipment.stops.at(-1)?.facilityName}</Text></View></View><AnimatedPressable haptic="light" onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })} style={[styles.trackButton, { backgroundColor: theme.surfaceElevated }]}><Text style={[styles.trackButtonText, { color: theme.text }]}>Track shipment</Text><Feather color={theme.text} name="arrow-right" size={15} /></AnimatedPressable></WorkspaceCard></View>;
}

function CustomerActionRow({ action, index }: { readonly action: HomeAction; readonly index: number }) {
  const router = useRouter();
  const theme = useTheme();
  const left = index % 2 === 0;
  return <AnimatedPressable accessibilityLabel={action.title} accessibilityRole="button" haptic="selection" onPress={() => router.push(action.route)} style={styles.featureRow}><View style={[styles.featureCircle, left ? styles.featureLeft : styles.featureRight, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Image source={action.image} style={styles.featureImage} /></View><View style={[styles.featureCopy, left ? styles.copyRight : styles.copyLeft]}><Text style={[styles.featureEyebrow, { color: theme.primaryLight }]}>{action.eyebrow}</Text><Text style={[styles.featureTitle, { color: theme.text }]}>{action.title}</Text><Text style={[styles.featureDescription, { color: theme.textSecondary }]}>{action.description}</Text><View style={styles.featureCta}><Text style={[styles.featureCtaText, { color: theme.primaryLight }]}>{action.cta}</Text><Feather color={theme.primaryLight} name="chevron-right" size={18} /></View></View></AnimatedPressable>;
}


const styles = StyleSheet.create({
  actionCard: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, gap: SPACE.sm, paddingVertical: SPACE.lg, width: "31%" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  actionIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 44, justifyContent: "center", width: 44 },
  actionLabel: { ...TYPO.subtitle, fontFamily: FONTS.semibold, textAlign: "center" },
  activityDot: { borderRadius: 4, height: 8, width: 8 },
  activityList: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: "hidden" },
  activityMeta: { ...TYPO.subtitle, marginTop: 2 },
  activityRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md, minHeight: 68, paddingHorizontal: 14 },
  activityStatus: { ...TYPO.metricLabel },
  activityTitle: { ...TYPO.captionStrong },
  attention: { alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: 13 },
  attentionIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 38, justifyContent: "center", width: 38 },
  attentionMeta: { ...TYPO.subtitle },
  attentionTitle: { ...TYPO.captionStrong },
  copyLeft: { paddingLeft: 20, paddingRight: 154 },
  copyRight: { paddingLeft: 154, paddingRight: 20 },
  currentMeta: { ...TYPO.caption, marginTop: 3 },
  currentSection: { gap: SPACE.sm, paddingHorizontal: 20, paddingTop: 25 },
  currentTitle: { ...TYPO.cardTitle },
  customerHero: { borderBottomWidth: 1, minHeight: 350, overflow: "hidden", paddingBottom: 30, paddingHorizontal: 24, paddingTop: 28 },
  customerHeroButton: { alignItems: "center", alignSelf: "flex-start", borderRadius: 24, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 48, paddingHorizontal: 19 },
  customerHeroButtonText: { ...TYPO.captionStrong, fontSize: 15 },
  customerHeroDescription: { ...TYPO.body, marginBottom: 22, marginTop: 16, maxWidth: "68%" },
  customerHeroTitle: { fontFamily: FONTS.bold, fontSize: 39, letterSpacing: -1.4, lineHeight: 43, maxWidth: "78%" },
  customerScroll: { paddingBottom: 112 },
  customerSectionDescription: { ...TYPO.body, lineHeight: 23, marginTop: 12, maxWidth: 345 },
  customerSectionTitle: { fontFamily: FONTS.bold, fontSize: 32, letterSpacing: -0.9, lineHeight: 36, marginTop: 13, maxWidth: 340 },
  driverAvatar: { borderRadius: 23, height: 46, overflow: "hidden", width: 46 },
  driverAvatarImage: { height: 46, width: 46 },
  driverChip: { alignItems: "center", gap: 6, minWidth: 58 },
  driverChipAvatar: { alignItems: "center", borderRadius: 25, borderWidth: 2, height: 50, justifyContent: "center", overflow: "hidden", width: 50 },
  driverChipImage: { height: 50, width: 50 },
  driverInitials: { ...TYPO.captionStrong },
  driverName: { ...TYPO.subtitle, maxWidth: 58, textAlign: "center" },
  emptyCopy: { ...TYPO.body },
  emptyTitle: { ...TYPO.cardTitle },
  endEyebrow: { ...TYPO.eyebrow },
  endNote: { gap: SPACE.sm, padding: 30, paddingBottom: 44 },
  endTitle: { ...TYPO.section, maxWidth: 330 },
  equipmentBanner: { alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: "row", gap: SPACE.md, minHeight: 92, overflow: "hidden", padding: 12 },
  equipmentImage: { borderRadius: RADIUS.md, height: 64, width: 78 },
  equipmentMeta: { ...TYPO.caption },
  equipmentTitle: { ...TYPO.rowTitle },
  featureCircle: { alignItems: "center", borderRadius: 68, borderWidth: 1, height: 136, justifyContent: "center", overflow: "hidden", position: "absolute", top: 24, width: 136 },
  featureCopy: { justifyContent: "center", minHeight: 185 },
  featureCta: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 11 },
  featureCtaText: { ...TYPO.captionStrong },
  featureDescription: { ...TYPO.caption, lineHeight: 20, marginTop: 8 },
  featureEyebrow: { ...TYPO.metricLabel },
  featureImage: { height: 136, width: 136 },
  featureLeft: { left: 10 },
  featureList: { gap: 6 },
  featureRight: { right: 10 },
  featureRow: { minHeight: 185, position: "relative" },
  featureTitle: { ...TYPO.heading, marginTop: 7 },
  fill: { flex: 1 },
  greeting: { fontFamily: FONTS.bold, fontSize: 26, letterSpacing: -0.3, lineHeight: 32 },
  greetingDate: { ...TYPO.eyebrow, marginBottom: 4 },
  greetingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  greetingSub: { ...TYPO.caption, marginTop: 2 },
  grow: { flex: 1, minWidth: 0 },
  heroArt: { height: 230, width: 230 },
  heroArtCircle: { alignItems: "flex-start", borderRadius: 115, borderWidth: 1, height: 230, justifyContent: "center", overflow: "hidden", position: "absolute", right: -96, top: 54, width: 230 },
  heroEyebrow: { ...TYPO.eyebrow, marginBottom: 15, maxWidth: "70%" },
  live: { alignItems: "center", borderRadius: 15, flexDirection: "row", gap: 5, minHeight: 30, paddingHorizontal: 9 },
  liveDot: { borderRadius: 3, height: 6, width: 6 },
  liveText: { ...TYPO.metricLabel },
  loadBadge: { alignItems: "center", borderRadius: RADIUS.pill, flexDirection: "row", gap: 5, minHeight: 27, paddingHorizontal: 9 },
  loadBadgeText: { ...TYPO.subtitle, textTransform: "capitalize" },
  loadCustomer: { ...TYPO.cardTitle },
  loadFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm },
  loadMeta: { alignItems: "center", flexDirection: "row", gap: 5 },
  loadMetaText: { ...TYPO.subtitle },
  loadPreview: { borderRadius: RADIUS.lg, borderWidth: 1, gap: 7, padding: 16 },
  loadPreviewRail: { minHeight: 178, width: 292 },
  loadPreviewTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  loadPreviewWide: { minHeight: 178, width: "100%" },
  loadRoute: { ...TYPO.caption },
  metricDot: { borderRadius: 3, height: 6, width: 6 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  metricLabel: { ...TYPO.metricLabel },
  metricMark: { alignItems: "center", borderRadius: 12, height: 24, justifyContent: "center", width: 24 },
  metricTile: { borderRadius: RADIUS.md, borderWidth: 1, flex: 1, gap: 3, minWidth: "22%", padding: 12 },
  metricValue: { ...TYPO.cardTitle },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  reviewButton: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1.5, minHeight: 40, justifyContent: "center", paddingHorizontal: SPACE.md },
  reviewText: { ...TYPO.captionStrong },
  sectionAction: { ...TYPO.captionStrong },
  sectionIntro: { paddingBottom: 29, paddingHorizontal: 24, paddingTop: 48 },
  sectionLabelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionPill: { ...TYPO.metricLabel, alignSelf: "flex-start", borderRadius: 16, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 7 },
  shipmentTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  smallEyebrow: { ...TYPO.eyebrow },
  staffScroll: { gap: SPACE.md, paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  staffSectionLabel: { ...TYPO.eyebrow, fontSize: 11 },
  trackButton: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 45 },
  trackButtonText: { ...TYPO.captionStrong },
});
