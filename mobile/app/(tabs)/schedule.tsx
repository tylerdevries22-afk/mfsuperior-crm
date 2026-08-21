import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ShipmentCard, SimulationBanner } from "@/components/operations";
import {
  EmptyState,
  Header,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
} from "@/components/ui";
import type { Shipment } from "@/domain/types";
import {
  filterScheduleShipments,
  type ScheduleDateFilter,
  type ScheduleStatusFilter,
} from "@/lib/tab-workspaces";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

const DATE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Upcoming", value: "upcoming" },
  { label: "All", value: "all" },
] as const;

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Tenders", value: "tenders" },
  { label: "Done", value: "completed" },
  { label: "All", value: "all" },
] as const;

function useScheduleData() {
  const { currentAccount, effectiveRole, shipments, state } = useOperations();
  const [dateFilter, setDateFilter] = useState<ScheduleDateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>("active");
  const role: "driver" | "dispatcher" = effectiveRole === "driver" ? "driver" : "dispatcher";

  const visibleLoads = useMemo(() => filterScheduleShipments(shipments, {
    role,
    driverId: currentAccount?.driverId,
    date: dateFilter,
    status: statusFilter,
    now: new Date(state.updatedAt),
  }), [currentAccount?.driverId, dateFilter, role, shipments, state.updatedAt, statusFilter]);

  const roleLoads = useMemo(() => filterScheduleShipments(shipments, {
    role,
    driverId: currentAccount?.driverId,
    date: "all",
    status: "all",
    now: new Date(state.updatedAt),
  }), [currentAccount?.driverId, role, shipments, state.updatedAt]);

  const activeCount = roleLoads.filter(({ status }) => !["tendered", "delivered", "declined", "cancelled"].includes(status)).length;
  const tenderCount = roleLoads.filter(({ status }) => status === "tendered").length;
  const doneCount = roleLoads.filter(({ status }) => status === "delivered").length;
  return { activeCount, dateFilter, doneCount, role, setDateFilter, setStatusFilter, statusFilter, tenderCount, visibleLoads };
}

function ScheduleHero({ role }: { readonly role: "driver" | "dispatcher" }) {
  const theme = useTheme();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>LOAD BOARD</Text>
      <Text style={[styles.title, { color: theme.text }]}>{role === "driver" ? "Your day on one board" : "Plan every move"}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Filter by service date and lifecycle status, then open a load for its full workflow.</Text>
    </View>
  );
}

function ScheduleFilters({ date, status, onDate, onStatus }: {
  readonly date: ScheduleDateFilter;
  readonly status: ScheduleStatusFilter;
  readonly onDate: (value: ScheduleDateFilter) => void;
  readonly onStatus: (value: ScheduleStatusFilter) => void;
}) {
  return (
    <>
      <SectionHeader title="Service date" />
      <SegmentedControl accessibilityLabel="Filter loads by service date" onChange={onDate} options={DATE_OPTIONS} value={date} />
      <SectionHeader title="Load status" />
      <SegmentedControl accessibilityLabel="Filter loads by status" onChange={onStatus} options={STATUS_OPTIONS} value={status} />
    </>
  );
}

function ScheduleResults({ loads, onReset }: { readonly loads: readonly Shipment[]; readonly onReset: () => void }) {
  const router = useRouter();
  return (
    <>
      <SectionHeader title={`${loads.length} ${loads.length === 1 ? "load" : "loads"}`} />
      {loads.length === 0 ? (
        <EmptyState actionLabel="Show all loads" description="No loads match both filters. Your locally saved records are still available." onAction={onReset} title="Nothing on this view" />
      ) : loads.map((shipment) => (
        <ShipmentCard key={shipment.id} onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })} shipment={shipment} />
      ))}
    </>
  );
}

export default function ScheduleScreen() {
  const theme = useTheme();
  const data = useScheduleData();

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        subtitle={data.role === "driver" ? "Assigned loads and appointments" : "All loads, tenders, and milestones"}
        title={data.role === "driver" ? "My schedule" : "Dispatch schedule"}
      />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <ScheduleHero role={data.role} />
        <View style={styles.statGrid}>
          <StatTile label="Active" value={String(data.activeCount)} />
          <StatTile label="Tenders" value={String(data.tenderCount)} />
          <StatTile label="Delivered" value={String(data.doneCount)} />
        </View>
        <SimulationBanner />
        <ScheduleFilters date={data.dateFilter} onDate={data.setDateFilter} onStatus={data.setStatusFilter} status={data.statusFilter} />
        <ScheduleResults loads={data.visibleLoads} onReset={() => { data.setDateFilter("all"); data.setStatusFilter("all"); }} />
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
