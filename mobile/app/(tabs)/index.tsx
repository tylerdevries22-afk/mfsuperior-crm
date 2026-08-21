import { useRouter } from "expo-router";
import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ShipmentCard, SimulationBanner, WorkspaceGrid, type WorkspaceAction } from "@/components/operations";
import { Badge, Card, Header, ListRow, Screen, SectionHeader, StatTile, StatusBadge } from "@/components/ui";
import type { AppRole } from "@/domain/types";
import { formatCurrency, formatMinutes } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { HOS_LIMITS } from "@/domain/transitions";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

function formattedToday(): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName?: string): string {
  return displayName?.trim().split(/\s+/)[0] || "there";
}

function DispatcherHome() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, shipments, state } = useOperations();
  const activeLoads = shipments.filter((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  const tenderCount = shipments.filter((shipment) => shipment.status === "tendered").length;
  const deliveredCount = shipments.filter((shipment) => shipment.status === "delivered").length;
  const openExceptions = state.exceptions.filter((exception) => exception.status !== "resolved").length;
  const upNext = activeLoads.find((shipment) => shipment.status !== "tendered") ?? activeLoads[0];

  const workspaces: readonly WorkspaceAction[] = [
    { key: "schedule", label: "Dispatch board", detail: `${activeLoads.length} active loads`, icon: "calendar-outline", onPress: () => router.push("/(tabs)/schedule") },
    { key: "assistant", label: "Operations assistant", detail: "Local demo guidance", icon: "sparkles-outline", tone: "info", onPress: () => router.push("/(tabs)/assistant") },
    { key: "customers", label: "Customers", detail: `${state.customers.length} accounts`, icon: "business-outline", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "customers" } }) },
    { key: "drivers", label: "Drivers", detail: `${state.drivers.length} teammates`, icon: "people-outline", tone: "success", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "drivers" } }) },
    { key: "quotes", label: "Freight quotes", detail: `${state.quotes.length} records`, icon: "calculator-outline", tone: "warning", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "quotes" } }) },
    { key: "analytics", label: "Analytics", detail: "Operational KPIs", icon: "bar-chart-outline", tone: "success", onPress: () => router.push("/analytics") },
    { key: "edi", label: "EDI audit", detail: "204 · 990 · 214", icon: "git-network-outline", tone: "info", onPress: () => router.push("/edi-audit") },
    { key: "fleet", label: "Fleet inventory", detail: `${state.equipment.length} assets`, icon: "bus-outline", onPress: () => router.push("/(tabs)/inventory") },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header brandTagline="Dispatch control" showBrand />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.grow}>
            <Text style={[styles.date, { color: theme.primaryLight }]}>{formattedToday()}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{greeting()}, {firstName(currentAccount?.displayName)}</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Here is the freight network at a glance.</Text>
          </View>
          <View style={styles.liveBlock}>
            <View style={[styles.liveOrb, { backgroundColor: theme.successMuted, borderColor: theme.tint.success.medium }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            </View>
            <Text style={[styles.liveText, { color: theme.success }]}>Local</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Active loads" value={String(activeLoads.length)} />
          <StatTile label="Open tenders" value={String(tenderCount)} />
          <StatTile label="Exceptions" value={String(openExceptions)} />
          <StatTile label="Delivered" value={String(deliveredCount)} />
        </View>

        <SimulationBanner />

        {upNext ? (
          <>
            <SectionHeader action="View schedule" onAction={() => router.push("/(tabs)/schedule")} title="Up next" />
            <ShipmentCard onPress={() => router.push({ pathname: "/load/[id]", params: { id: upNext.id } })} shipment={upNext} />
          </>
        ) : null}

        <SectionHeader title="Workspaces" />
        <WorkspaceGrid actions={workspaces} />

        <SectionHeader action="See all" onAction={() => router.push("/history")} title="Recent activity" />
        <Card padding="none">
          {shipments.slice(0, 3).map((shipment, index) => (
            <ListRow
              isLast={index === Math.min(shipments.length, 3) - 1}
              key={shipment.id}
              meta={shipment.targetLoadId}
              onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })}
              subtitle={`${shipment.events.at(-1)?.description ?? "Shipment created"} · ${shipment.events.length} events`}
              title={shipment.stops.at(-1)?.facilityName ?? "Delivery"}
              trailing={<StatusBadge status={shipment.status} />}
            />
          ))}
        </Card>
      </Screen>
    </View>
  );
}

function DriverHome() {
  const router = useRouter();
  const theme = useTheme();
  const { activeShipment, currentAccount, hosClock, shipments, state } = useOperations();
  const assignedLoads = shipments;
  const drivingRemaining = hosClock ? HOS_LIMITS.drivingMinutes - hosClock.drivingMinutesUsed : 0;
  const shiftRemaining = hosClock ? HOS_LIMITS.shiftMinutes - hosClock.shiftMinutesUsed : 0;

  const actions: readonly WorkspaceAction[] = [
    { key: "gps", label: "GPS tracking", detail: "Device simulation", icon: "navigate-circle-outline", tone: "success", onPress: () => router.push("/location-tracker") },
    { key: "route", label: "Route plan", detail: activeShipment?.targetLoadId ?? "No active load", icon: "map-outline", tone: "info", onPress: () => activeShipment ? router.push({ pathname: "/route-planner/[id]", params: { id: activeShipment.id } }) : router.push("/(tabs)/schedule") },
    { key: "hos", label: "Hours of service", detail: formatMinutes(drivingRemaining), icon: "timer-outline", tone: "warning", onPress: () => router.push("/hours-of-service") },
    { key: "messages", label: "Dispatch messages", detail: `${state.messages.length} messages`, icon: "chatbubbles-outline", onPress: () => router.push("/messages") },
    { key: "exception", label: "Report exception", detail: "Delay, cargo, equipment", icon: "warning-outline", tone: "warning", onPress: () => router.push({ pathname: "/exception/new", params: activeShipment ? { shipmentId: activeShipment.id } : {} }) },
    { key: "fleet", label: "Driver equipment", detail: "Gear and supplies", icon: "construct-outline", onPress: () => router.push("/(tabs)/inventory") },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header brandTagline="Driver workspace" showBrand />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.grow}>
            <Text style={[styles.date, { color: theme.primaryLight }]}>{formattedToday()}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{greeting()}, {firstName(currentAccount?.displayName)}</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Your load, route, and duty clock are together here.</Text>
          </View>
          <Badge label={hosClock ? hosClock.status.replaceAll("_", " ") : "HOS unavailable"} showDot tone="success" />
        </View>

        <SimulationBanner message="Target partner load and EDI events are simulated locally. GPS only starts after you choose it." />

        <SectionHeader action="Schedule" onAction={() => router.push("/(tabs)/schedule")} title="Active load" />
        {activeShipment ? (
          <ShipmentCard
            footer={
              <View style={styles.inlineActions}>
                <Badge label={`${formatMinutes(drivingRemaining)} drive left`} tone="warning" />
                <Badge label={`${formatMinutes(shiftRemaining)} shift left`} tone="info" />
              </View>
            }
            onPress={() => router.push({ pathname: "/load/[id]", params: { id: activeShipment.id } })}
            shipment={activeShipment}
          />
        ) : (
          <Card>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No active load assigned</Text>
            <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>Open the schedule to review upcoming loads and tenders.</Text>
          </Card>
        )}

        <View style={styles.statGrid}>
          <StatTile label="Assigned" value={String(assignedLoads.length)} />
          <StatTile label="Drive left" value={formatMinutes(drivingRemaining)} />
        </View>

        <SectionHeader title="Quick actions" />
        <WorkspaceGrid actions={actions} />
      </Screen>
    </View>
  );
}

function CustomerHome() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, customerRequests, quotes, shipments } = useOperations();
  const customerShipments = shipments;
  const inMotion = customerShipments.find((shipment) => !["delivered", "declined", "cancelled"].includes(shipment.status));
  const openRequests = customerRequests.filter((request) => !["closed"].includes(request.status));
  const openQuoteTotal = quotes.filter((quote) => quote.status === "sent").reduce((total, quote) => total + quote.totalCents, 0);

  const actions: readonly WorkspaceAction[] = [
    { key: "shipments", label: "Track shipments", detail: `${customerShipments.length} loads`, icon: "cube-outline", tone: "success", onPress: () => router.push("/(tabs)/shipments") },
    { key: "request", label: "Request service", detail: "Quote, pickup, delivery", icon: "document-text-outline", onPress: () => router.push("/(tabs)/requests") },
    { key: "messages", label: "Message support", detail: "Operations thread", icon: "chatbubble-ellipses-outline", tone: "info", onPress: () => router.push("/messages") },
    { key: "history", label: "Delivery history", detail: "POD and milestones", icon: "time-outline", tone: "warning", onPress: () => router.push("/history") },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header brandTagline="Customer portal" showBrand />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.grow}>
            <Text style={[styles.date, { color: theme.primaryLight }]}>{formattedToday()}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{greeting()}, {firstName(currentAccount?.displayName)}</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Track freight and request your next move.</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Shipments" value={String(customerShipments.length)} />
          <StatTile label="Open requests" value={String(openRequests.length)} />
          <StatTile label="Quoted" value={formatCurrency(openQuoteTotal)} />
        </View>

        <SimulationBanner message="Customer and Target partner records are local demonstration data only." />

        {inMotion ? (
          <>
            <SectionHeader action="View all" onAction={() => router.push("/(tabs)/shipments")} title="In motion" />
            <ShipmentCard onPress={() => router.push({ pathname: "/load/[id]", params: { id: inMotion.id } })} shipment={inMotion} />
          </>
        ) : null}

        <SectionHeader title="Customer tools" />
        <WorkspaceGrid actions={actions} />

        <SectionHeader action="Open requests" onAction={() => router.push("/(tabs)/requests")} title="Latest requests" />
        <Card padding="none">
          {customerRequests.slice(0, 3).map((request, index) => (
            <ListRow
              isLast={index === Math.min(customerRequests.length, 3) - 1}
              key={request.id}
              meta={request.type}
              onPress={() => router.push("/(tabs)/requests")}
              subtitle={request.details}
              title={request.subject}
              trailing={<StatusBadge status={request.status} />}
            />
          ))}
        </Card>
      </Screen>
    </View>
  );
}

const HOME_BY_ROLE: Readonly<Record<AppRole, ComponentType>> = {
  customer: CustomerHome,
  driver: DriverHome,
  dispatcher: DispatcherHome,
};

export default function HomeScreen() {
  const { currentAccount, effectiveRole } = useOperations();
  const role: AppRole = effectiveRole ?? currentAccount?.role ?? "customer";
  const Home = HOME_BY_ROLE[role];
  return <Home />;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  date: { ...TYPO.eyebrow },
  emptyCopy: { ...TYPO.body },
  emptyTitle: { ...TYPO.cardTitle },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xs },
  heroRow: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.md, paddingBottom: SPACE.sm },
  heroSubtitle: { ...TYPO.body },
  heroTitle: { ...TYPO.screenTitle, fontSize: 34, lineHeight: 39 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  liveBlock: { alignItems: "center", gap: SPACE.xs },
  liveDot: { borderRadius: RADIUS.pill, height: 10, width: 10 },
  liveOrb: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  liveText: { ...TYPO.captionStrong },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
});
