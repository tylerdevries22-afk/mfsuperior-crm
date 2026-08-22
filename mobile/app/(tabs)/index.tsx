import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { ComponentType } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import { AnimatedPressable, Header, HorizontalCarousel, WorkspaceCard } from "@/components/ui";
import type { AppRole, Shipment } from "@/domain/types";
import { DriverAvatar } from "@/components/operations";
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

export default function HomeScreen() {
  const { effectiveRole } = useOperations();
  const role = effectiveRole ?? "customer";
  const Screen = HOME_BY_ROLE[role];
  return <Screen />;
}

function CustomerHome() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, shipments } = useOperations();
  const name = currentAccount?.displayName.split(/\s+/)[0] ?? "there";
  const active = shipments.find((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header showLogo /><ScrollView contentContainerStyle={styles.customerScroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><CustomerHero name={name} onRequest={() => router.push("/(tabs)/requests")} />{active ? <CurrentShipment shipment={active} /> : null}<View style={styles.sectionIntro}><Text style={[styles.sectionPill, { backgroundColor: theme.primaryMuted, color: theme.primaryLight }]}>MF SUPERIOR FREIGHT</Text><Text style={[styles.customerSectionTitle, { color: theme.text }]}>Everything Your Freight Needs</Text><Text style={[styles.customerSectionDescription, { color: theme.textSecondary }]}>Service built around your lanes, your timing, and real help from a local team.</Text></View><View style={styles.featureList}>{CUSTOMER_ACTIONS.map((action, index) => <CustomerActionRow action={action} index={index} key={action.key} />)}</View><View style={styles.endNote}><Text style={[styles.endEyebrow, { color: theme.primaryLight }]}>OWNER OPERATED · DENVER, COLORADO</Text><Text style={[styles.endTitle, { color: theme.text }]}>Freight handled with clarity from pickup to final delivery.</Text></View></ScrollView></View>;
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

function AdminHome() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, shipments, state } = useOperations();
  const active = shipments.filter((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  const attention = state.exceptions.filter((item) => item.status !== "resolved");
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header brandTagline="Admin operations" showLogo /><ScrollView contentContainerStyle={styles.staffScroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><StaffGreeting name={currentAccount?.displayName} subtitle="Your freight network at a glance" /><MetricTiles values={[{ value: String(active.length), label: "Active loads", tone: "brand" }, { value: String(state.drivers.filter((driver) => driver.status === "available").length), label: "Available", tone: "success" }, { value: String(attention.length), label: "Attention", tone: "warning" }, { value: "96%", label: "On time", tone: "info" }]} />{attention.length ? <AttentionCard onPress={() => router.push("/exception-diagnostic")} title={`${attention.length} exception${attention.length === 1 ? "" : "s"} need review`} /> : null}<SectionLabel action="View team" onAction={() => router.push("/team")} title="DRIVERS" /><DriverStrip /><SectionLabel action="View schedule" onAction={() => router.push("/(tabs)/schedule")} title="UP NEXT" /><HorizontalCarousel accessibilityLabel="Upcoming freight" data={active.slice(0, 4)} itemWidth={292} keyExtractor={(item) => item.id} renderItem={({ item }) => <LoadPreview shipment={item} />} /><SectionLabel title="QUICK ACTIONS" /><QuickActionGrid actions={[{ icon: "briefcase", label: "Shippers", route: "/customers" }, { icon: "truck", label: "Loads", route: "/loads" }, { icon: "file-text", label: "Quotes", route: "/quotes" }, { icon: "bar-chart-2", label: "Analytics", route: "/analytics" }, { icon: "activity", label: "EDI events", route: "/integration-events" }, { icon: "grid", label: "Capacity", route: "/capacity" }]} /><SectionLabel action="See all" onAction={() => router.push("/history")} title="RECENT ACTIVITY" /><ActivityList shipments={shipments.slice(0, 3)} /></ScrollView></View>;
}

function DriverHome() {
  const router = useRouter();
  const theme = useTheme();
  const { activeShipment, currentAccount, hosClock, shipments } = useOperations();
  const driveLeft = hosClock ? Math.max(0, 660 - hosClock.drivingMinutesUsed) : 0;
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header brandTagline="Driver workspace" showLogo /><ScrollView contentContainerStyle={styles.staffScroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><StaffGreeting name={currentAccount?.displayName} subtitle="Your route and duty day" /><MetricTiles values={[{ value: String(shipments.length), label: "Assigned", tone: "brand" }, { value: `${Math.floor(driveLeft / 60)}h ${driveLeft % 60}m`, label: "Drive left", tone: "success" }, { value: hosClock?.status.replaceAll("_", " ") ?? "Off duty", label: "Duty", tone: "info" }]} /><SectionLabel action="Schedule" onAction={() => router.push("/(tabs)/schedule")} title="ACTIVE LOAD" />{activeShipment ? <LoadPreview shipment={activeShipment} wide /> : <WorkspaceCard><Text style={[styles.emptyTitle, { color: theme.text }]}>No active load assigned</Text><Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>Open Schedule to review upcoming assignments and tenders.</Text></WorkspaceCard>}<SectionLabel title="QUICK ACTIONS" /><QuickActionGrid actions={[{ icon: "navigation", label: "Route", route: activeShipment ? `/route-planner/${activeShipment.id}` : "/(tabs)/schedule" }, { icon: "clock", label: "HOS", route: "/hours-of-service" }, { icon: "alert-triangle", label: "Exception", route: "/exception/new" }, { icon: "camera", label: "POD", route: activeShipment ? `/proof-of-delivery/${activeShipment.id}` : "/(tabs)/schedule" }, { icon: "message-circle", label: "Messages", route: "/messages" }, { icon: "tool", label: "Toolbox", route: "/driver-toolbox" }]} /><SectionLabel title="ASSIGNED EQUIPMENT" /><Pressable accessibilityRole="button" onPress={() => router.push("/capacity/equipment")} style={({ pressed }) => [styles.equipmentBanner, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><Image source={equipmentArt} style={styles.equipmentImage} /><View style={styles.grow}><Text style={[styles.equipmentTitle, { color: theme.text }]}>Tractor 104 · Trailer R-218</Text><Text style={[styles.equipmentMeta, { color: theme.textSecondary }]}>Ready · Reefer setpoint 36°F</Text></View><Feather color={theme.textMuted} name="chevron-right" size={18} /></Pressable></ScrollView></View>;
}

function StaffGreeting({ name, subtitle }: { readonly name?: string; readonly subtitle: string }) {
  const theme = useTheme();
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date());
  return <View style={styles.greetingRow}><View style={styles.grow}><Text style={[styles.greetingDate, { color: theme.primaryLight }]}>{date}</Text><Text style={[styles.greeting, { color: theme.text }]}>Good day, {name?.split(/\s+/)[0] ?? "there"}</Text><Text style={[styles.greetingSub, { color: theme.textMuted }]}>{subtitle}</Text></View><View style={[styles.live, { backgroundColor: theme.successMuted }]}><View style={[styles.liveDot, { backgroundColor: theme.success }]} /><Text style={[styles.liveText, { color: theme.success }]}>LIVE</Text></View></View>;
}

type MetricTone = "brand" | "success" | "warning" | "info";
function MetricTiles({ values }: { readonly values: readonly { readonly value: string; readonly label: string; readonly tone: MetricTone }[] }) {
  const theme = useTheme();
  const colors = { brand: theme.primaryLight, success: theme.success, warning: theme.warning, info: theme.info };
  return <View style={styles.metricGrid}>{values.map((item) => <View key={item.label} style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.metricMark, { backgroundColor: `${colors[item.tone]}18` }]}><View style={[styles.metricDot, { backgroundColor: colors[item.tone] }]} /></View><Text numberOfLines={1} style={[styles.metricValue, { color: theme.text }]}>{item.value}</Text><Text style={[styles.metricLabel, { color: theme.textMuted }]}>{item.label}</Text></View>)}</View>;
}

function AttentionCard({ title, onPress }: { readonly title: string; readonly onPress: () => void }) {
  const theme = useTheme();
  return <View style={[styles.attention, { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium }]}><View style={[styles.attentionIcon, { backgroundColor: `${theme.warning}18` }]}><Feather color={theme.warning} name="alert-triangle" size={18} /></View><View style={styles.grow}><Text style={[styles.attentionTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.attentionMeta, { color: theme.textSecondary }]}>Review evidence and assign the next action.</Text></View><AnimatedPressable haptic="selection" onPress={onPress} style={[styles.reviewButton, { borderColor: theme.text }]}><Text style={[styles.reviewText, { color: theme.text }]}>Review</Text></AnimatedPressable></View>;
}

function SectionLabel({ title, action, onAction }: { readonly title: string; readonly action?: string; readonly onAction?: () => void }) {
  const theme = useTheme();
  return <View style={styles.sectionLabelRow}><Text style={[styles.staffSectionLabel, { color: theme.textMuted }]}>{title}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={[styles.sectionAction, { color: theme.primaryLight }]}>{action}</Text></Pressable> : null}</View>;
}

function DriverStrip() {
  const theme = useTheme();
  const { state } = useOperations();
  // Each driver renders their own portrait. The previous `index === 0` check
  // gave the first driver a generic stock image and everyone else initials.
  return <HorizontalCarousel accessibilityLabel="Driver team" data={state.drivers} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={styles.driverChip}><View style={[styles.driverChipAvatar, { borderColor: item.status === "available" ? theme.success : theme.border }]}><DriverAvatar driver={item} ring={false} size={46} /></View><Text numberOfLines={1} style={[styles.driverName, { color: theme.textSecondary }]}>{item.firstName}</Text></View>} />;
}

function LoadPreview({ shipment, wide = false }: { readonly shipment: Shipment; readonly wide?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  return <AnimatedPressable accessibilityRole="button" haptic="light" onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })} style={[styles.loadPreview, wide ? styles.loadPreviewWide : styles.loadPreviewRail, { backgroundColor: theme.surface, borderColor: theme.tint.primary.medium }]}><View style={styles.loadPreviewTop}><View style={[styles.loadBadge, { backgroundColor: theme.primaryMuted }]}><Feather color={theme.primaryLight} name="clock" size={13} /><Text style={[styles.loadBadgeText, { color: theme.primaryLight }]}>{shipment.status.replaceAll("_", " ")}</Text></View><Feather color={theme.textMuted} name="more-horizontal" size={18} /></View><Text style={[styles.loadCustomer, { color: theme.text }]}>{shipment.loadNumber}</Text><Text numberOfLines={1} style={[styles.loadRoute, { color: theme.textSecondary }]}>{shipment.stops[0]?.address.city} → {shipment.stops.at(-1)?.address.city}</Text><View style={styles.loadFooter}><View style={styles.loadMeta}><Feather color={theme.textMuted} name="box" size={13} /><Text style={[styles.loadMetaText, { color: theme.textMuted }]}>{shipment.palletCount} pallets · {shipment.weightPounds.toLocaleString()} lb</Text></View><Feather color={theme.primaryLight} name="arrow-right" size={16} /></View></AnimatedPressable>;
}

function QuickActionGrid({ actions }: { readonly actions: readonly { readonly icon: React.ComponentProps<typeof Feather>["name"]; readonly label: string; readonly route: string }[] }) {
  const router = useRouter();
  const theme = useTheme();
  return <View style={styles.actionGrid}>{actions.map((action) => <AnimatedPressable accessibilityRole="button" haptic="selection" key={action.label} onPress={() => router.push(action.route as Href)} style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.actionIcon, { backgroundColor: theme.primaryMuted }]}><Feather color={theme.primaryLight} name={action.icon} size={20} /></View><Text style={[styles.actionLabel, { color: theme.textSecondary }]}>{action.label}</Text></AnimatedPressable>)}</View>;
}

function ActivityList({ shipments }: { readonly shipments: readonly Shipment[] }) {
  const theme = useTheme();
  return <View style={[styles.activityList, { backgroundColor: theme.surface, borderColor: theme.border }]}>{shipments.map((shipment, index) => <View key={shipment.id} style={[styles.activityRow, index < shipments.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><View style={[styles.activityDot, { backgroundColor: shipment.status === "exception" ? theme.warning : theme.success }]} /><View style={styles.grow}><Text style={[styles.activityTitle, { color: theme.text }]}>{shipment.loadNumber}</Text><Text style={[styles.activityMeta, { color: theme.textMuted }]}>{shipment.events.at(-1)?.description}</Text></View><Text style={[styles.activityStatus, { color: theme.primaryLight }]}>{shipment.status.replaceAll("_", " ")}</Text></View>)}</View>;
}

const HOME_BY_ROLE: Readonly<Record<AppRole, ComponentType>> = { admin: AdminHome, customer: CustomerHome, driver: DriverHome };

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
