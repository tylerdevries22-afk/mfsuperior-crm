import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { WorkspaceGrid, type WorkspaceAction } from "@/components/operations";
import { Card, EmptyState, Header, ListRow, Screen, SectionHeader, SegmentedControl, StatTile, StatusBadge } from "@/components/ui";
import type { AppRole, Equipment } from "@/domain/types";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type AssetFilter = "all" | "available" | "assigned" | "service";

const ASSET_FILTERS = [
  { label: "All", value: "all" },
  { label: "Ready", value: "available" },
  { label: "Assigned", value: "assigned" },
  { label: "Service", value: "service" },
] as const;

function roleCanSeeEquipment(equipment: Equipment, role: AppRole, driverId?: string): boolean {
  if (role === "admin") return true;
  const fieldSupply = !["tractor", "trailer", "reefer_unit", "maintenance_part"].includes(equipment.kind);
  return equipment.assignedDriverId === driverId || fieldSupply;
}

function matchesAssetFilter(equipment: Equipment, filter: AssetFilter): boolean {
  if (filter === "all") return true;
  if (filter === "service") return ["maintenance", "out_of_service"].includes(equipment.status);
  return equipment.status === filter;
}

function equipmentIcon(kind: Equipment["kind"]): "bus-outline" | "cube-outline" | "shield-checkmark-outline" | "construct-outline" {
  if (kind === "tractor") return "bus-outline";
  if (kind === "trailer" || kind === "reefer_unit") return "cube-outline";
  if (kind === "safety_gear" || kind === "load_securement") return "shield-checkmark-outline";
  return "construct-outline";
}

function AssetList({ equipment }: { readonly equipment: readonly Equipment[] }) {
  const router = useRouter();
  const theme = useTheme();
  if (equipment.length === 0) {
    return <EmptyState description="No equipment matches this status filter." title="No matching assets" />;
  }

  return (
    <Card padding="none">
      {equipment.map((asset, index) => (
        <ListRow
          isLast={index === equipment.length - 1}
          key={asset.id}
          leading={<View style={[styles.assetIcon, { backgroundColor: theme.primaryMuted }]}><Ionicons color={theme.primaryLight} name={equipmentIcon(asset.kind)} size={ICON.md} /></View>}
          meta={`Qty ${asset.quantity}`}
          onPress={() => router.push({ pathname: "/capacity/[id]", params: { id: asset.id } })}
          subtitle={`${asset.assetNumber} · ${asset.description}`}
          title={asset.name}
          trailing={<StatusBadge size="sm" status={asset.status} />}
        />
      ))}
    </Card>
  );
}

function fleetWorkspaceActions(role: AppRole, open: (route: string) => void): readonly WorkspaceAction[] {
  const shared: readonly WorkspaceAction[] = [
    { key: "models", label: "Equipment models", detail: "Tractors and trailers", icon: "bus-outline", onPress: () => open("/equipment") },
    { key: "gear", label: "Driver equipment", detail: "PPE and securement", icon: "shield-checkmark-outline", tone: "success", onPress: () => open("/driver-toolbox") },
    { key: "scan", label: "Scan asset", detail: "VIN, unit, or document", icon: "scan-outline", tone: "info", onPress: () => open("/capacity/scan") },
    { key: "transfers", label: "Asset transfers", detail: "Driver, load, or terminal", icon: "swap-horizontal-outline", tone: "warning", onPress: () => open("/capacity/transfer") },
  ];
  if (role === "driver") return [...shared,
    { key: "truck", label: "My truck", detail: "Assigned equipment", icon: "briefcase-outline", onPress: () => open("/capacity/equipment") },
    { key: "roadside", label: "Fuel & roadside", detail: "Safety and provider directory", icon: "trail-sign-outline", tone: "warning", onPress: () => open("/suppliers") },
  ];
  return [...shared,
    { key: "parts", label: "Equipment market", detail: "Acquire or lease", icon: "cog-outline", onPress: () => open("/equipment-marketplace") },
    { key: "orders", label: "Capacity orders", detail: "Purchase and receive", icon: "receipt-outline", tone: "info", onPress: () => open("/capacity/orders") },
    { key: "vendors", label: "Suppliers", detail: "Provider-neutral directory", icon: "storefront-outline", tone: "warning", onPress: () => open("/suppliers") },
    { key: "cost", label: "Utilization", detail: "Asset performance", icon: "bar-chart-outline", tone: "success", onPress: () => open("/capacity/analytics") },
  ];
}

export default function InventoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, effectiveRole, state } = useOperations();
  const [filter, setFilter] = useState<AssetFilter>("all");
  const role = effectiveRole ?? currentAccount?.role ?? "driver";
  const driverId = role === "driver" ? currentAccount?.driverId ?? state.drivers[0]?.id : undefined;
  const visibleEquipment = useMemo(() => state.equipment
    .filter((asset) => roleCanSeeEquipment(asset, role, driverId))
    .filter((asset) => matchesAssetFilter(asset, filter)), [driverId, filter, role, state.equipment]);
  const allRoleEquipment = state.equipment.filter((asset) => roleCanSeeEquipment(asset, role, driverId));
  const open = (route: string) => router.push(route as never);
  const actions = fleetWorkspaceActions(role, open);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle={role === "driver" ? "Assigned assets and field supplies" : "Assets, bookings, readiness, and utilization"} title="Capacity" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>CAPACITY ASSETS</Text>
          <Text style={[styles.title, { color: theme.text }]}>{role === "driver" ? "Everything riding with you" : "Capacity at a glance"}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review power, trailers, assigned units, field gear, bookings, and readiness.</Text>
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Visible assets" value={String(allRoleEquipment.length)} />
          <StatTile label="Assigned" value={String(allRoleEquipment.filter(({ status }) => status === "assigned").length)} />
          <StatTile label="Available units" value={String(allRoleEquipment.filter(({ status }) => status === "available").reduce((total, asset) => total + asset.quantity, 0))} />
        </View>

        <SectionHeader title="Workspaces" />
        <WorkspaceGrid actions={actions} />

        <SectionHeader title="Equipment status" />
        <SegmentedControl accessibilityLabel="Filter equipment by status" onChange={setFilter} options={ASSET_FILTERS} value={filter} />

        <SectionHeader title={`${visibleEquipment.length} ${visibleEquipment.length === 1 ? "record" : "records"}`} />
        <AssetList equipment={visibleEquipment} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  assetIcon: { alignItems: "center", borderRadius: RADIUS.sm, height: 42, justifyContent: "center", width: 42 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  hero: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  subtitle: { ...TYPO.body, maxWidth: 560 },
  title: { ...TYPO.screenTitle },
});
