import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SimulationBanner, WorkspaceGrid, type WorkspaceAction } from "@/components/operations";
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
  if (role === "dispatcher") return true;
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
          onPress={() => router.push({ pathname: "/feature/[slug]", params: { slug: "equipment-models" } })}
          subtitle={`${asset.assetNumber} · ${asset.description}`}
          title={asset.name}
          trailing={<StatusBadge size="sm" status={asset.status} />}
        />
      ))}
    </Card>
  );
}

function fleetWorkspaceActions(role: AppRole, open: (slug: string) => void): readonly WorkspaceAction[] {
  const shared: readonly WorkspaceAction[] = [
    { key: "models", label: "Equipment models", detail: "Tractors and trailers", icon: "bus-outline", onPress: () => open("equipment-models") },
    { key: "gear", label: "Driver equipment", detail: "PPE and securement", icon: "shield-checkmark-outline", tone: "success", onPress: () => open("driver-gear") },
    { key: "scan", label: "Scan asset", detail: "Tags, seals, documents", icon: "scan-outline", tone: "info", onPress: () => open("asset-scan") },
    { key: "transfers", label: "Asset transfers", detail: "Yard and truck stock", icon: "swap-horizontal-outline", tone: "warning", onPress: () => open("stock-transfers") },
  ];
  if (role === "driver") return [...shared,
    { key: "truck", label: "My truck", detail: "Assigned inventory", icon: "briefcase-outline", onPress: () => open("truck-inventory") },
    { key: "roadside", label: "Fuel & roadside", detail: "Local demo services", icon: "trail-sign-outline", tone: "warning", onPress: () => open("fuel-roadside") },
  ];
  return [...shared,
    { key: "parts", label: "Fleet parts", detail: "Approved catalog", icon: "cog-outline", onPress: () => open("fleet-parts") },
    { key: "orders", label: "Fleet orders", detail: "Purchase and receive", icon: "receipt-outline", tone: "info", onPress: () => open("parts-orders") },
    { key: "vendors", label: "Maintenance vendors", detail: "Local demo portal", icon: "storefront-outline", tone: "warning", onPress: () => open("maintenance-vendor") },
    { key: "cost", label: "Fleet analytics", detail: "Cost per mile", icon: "bar-chart-outline", tone: "success", onPress: () => open("fleet-cost-analytics") },
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
  const open = (slug: string) => router.push({ pathname: "/feature/[slug]", params: { slug } });
  const actions = fleetWorkspaceActions(role, open);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle={role === "driver" ? "Assigned assets and field supplies" : "Assets, stock, orders, and service"} title="Fleet" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>EQUIPMENT & INVENTORY</Text>
          <Text style={[styles.title, { color: theme.text }]}>{role === "driver" ? "Everything riding with you" : "The fleet at a glance"}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review operating assets, field gear, service resources, and inventory workflows.</Text>
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Visible assets" value={String(allRoleEquipment.length)} />
          <StatTile label="Assigned" value={String(allRoleEquipment.filter(({ status }) => status === "assigned").length)} />
          <StatTile label="Available units" value={String(allRoleEquipment.filter(({ status }) => status === "available").reduce((total, asset) => total + asset.quantity, 0))} />
        </View>

        <SimulationBanner message="Vendor catalogs, service availability, scans, and orders are local prototype interactions." />

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
