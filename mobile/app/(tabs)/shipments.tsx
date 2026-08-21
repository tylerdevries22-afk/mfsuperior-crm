import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ShipmentCard, SimulationBanner } from "@/components/operations";
import { EmptyState, Header, Screen, SearchField, SectionHeader, SegmentedControl, StatTile } from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

type ShipmentFilter = "active" | "delivered" | "all";

const FILTER_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Delivered", value: "delivered" },
  { label: "All", value: "all" },
] as const;

function matchesFilter(shipment: Shipment, filter: ShipmentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "delivered") return shipment.status === "delivered";
  return !["delivered", "declined", "cancelled"].includes(shipment.status);
}

function matchesQuery(shipment: Shipment, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const searchable = [
    shipment.targetLoadId,
    shipment.purchaseOrderNumber,
    shipment.proNumber,
    shipment.commodity,
    ...shipment.stops.flatMap(({ facilityName, address }) => [facilityName, address.city, address.state]),
  ];
  return searchable.some((value) => value.toLowerCase().includes(normalized));
}

function ShipmentsHero() {
  const theme = useTheme();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>CUSTOMER TRACKING</Text>
      <Text style={[styles.title, { color: theme.text }]}>Freight without the guesswork</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Open any load for its route, appointment windows, event history, and proof of delivery.</Text>
    </View>
  );
}

function ShipmentStats({ shipments, openExceptions }: { readonly shipments: readonly Shipment[]; readonly openExceptions: number }) {
  return (
    <View style={styles.statGrid}>
      <StatTile label="Active" value={String(shipments.filter((shipment) => matchesFilter(shipment, "active")).length)} />
      <StatTile label="Delivered" value={String(shipments.filter(({ status }) => status === "delivered").length)} />
      <StatTile label="Open exceptions" value={String(openExceptions)} />
    </View>
  );
}

function ShipmentResults({ shipments, onClear }: { readonly shipments: readonly Shipment[]; readonly onClear: () => void }) {
  const router = useRouter();
  return (
    <>
      <SectionHeader title={`${shipments.length} ${shipments.length === 1 ? "shipment" : "shipments"}`} />
      {shipments.length === 0 ? (
        <EmptyState actionLabel="Clear filters" description="Try another load number, location, or shipment status." onAction={onClear} title="No shipments found" />
      ) : shipments.map((shipment) => (
        <ShipmentCard key={shipment.id} onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })} shipment={shipment} />
      ))}
    </>
  );
}

export default function CustomerShipmentsScreen() {
  const theme = useTheme();
  const { currentAccount, shipments, state } = useOperations();
  const [filter, setFilter] = useState<ShipmentFilter>("active");
  const [query, setQuery] = useState("");
  const customerId = currentAccount?.customerId ?? state.customers[0]?.id;
  const customerShipments = useMemo(() => shipments.filter(
    (shipment) => shipment.customerId === customerId,
  ), [customerId, shipments]);
  const visibleShipments = useMemo(() => customerShipments
    .filter((shipment) => matchesFilter(shipment, filter))
    .filter((shipment) => matchesQuery(shipment, query)), [customerShipments, filter, query]);
  const openExceptions = state.exceptions.filter((report) => report.status !== "resolved" && customerShipments.some(({ id }) => id === report.shipmentId)).length;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle="Milestones, appointments, and delivery records" title="Shipments" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <ShipmentsHero />
        <ShipmentStats openExceptions={openExceptions} shipments={customerShipments} />
        <SimulationBanner message="Shipment locations, milestones, Target partner events, and delivery records are local demonstration data." />
        <SearchField label="Search shipments" onChangeText={setQuery} placeholder="Load, PO, PRO, city, or commodity" value={query} />
        <SegmentedControl accessibilityLabel="Filter customer shipments" onChange={setFilter} options={FILTER_OPTIONS} value={filter} />
        <ShipmentResults shipments={visibleShipments} onClear={() => { setQuery(""); setFilter("all"); }} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  hero: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  subtitle: { ...TYPO.body, maxWidth: 560 },
  title: { ...TYPO.screenTitle },
});
