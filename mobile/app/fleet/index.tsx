import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  Badge,
  Card,
  EmptyState,
  Header,
  Screen,
  SegmentedControl,
} from "@/components/ui";
import type { VehicleStatus } from "@/domain/types";
import {
  VEHICLE_STATUS_LABELS,
  buildFleetEntries,
  describeVehicle,
  formatOdometer,
  summarizeFleet,
  vehicleStatusTone,
  type FleetEntry,
} from "@/route-support/fleet/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type FleetFilter = "all" | "tractor" | "trailer";

export type FleetScreenProps = {
  readonly isTab?: boolean;
};

const FILTER_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Tractors", value: "tractor" as const },
  { label: "Trailers", value: "trailer" as const },
];

export function FleetScreen({ isTab = false }: FleetScreenProps = {}) {
  const router = useRouter();
  const theme = useTheme();
  const {
    complianceDocuments,
    effectiveRole,
    maintenanceOrders,
    state,
    vehicles,
  } = useOperations();
  const [filter, setFilter] = useState<FleetFilter>("all");

  const entries = useMemo(
    () => buildFleetEntries(vehicles, state.drivers, maintenanceOrders, complianceDocuments),
    [complianceDocuments, maintenanceOrders, state.drivers, vehicles],
  );
  const visible = useMemo(
    () => filter === "all" ? entries : entries.filter((entry) => entry.vehicle.type === filter),
    [entries, filter],
  );
  const totals = useMemo(() => summarizeFleet(entries), [entries]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Fleet" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="truck" size={36} />}
            message="The fleet register is a dispatch console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={isTab ? undefined : () => router.back()}
        showBack={!isTab}
        subtitle={`${totals.total} units · ${totals.active} active`}
        title="Fleet"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <View style={styles.totalsRow}>
          <Total label="Active" value={totals.active} />
          <Total label="Down" tone={totals.down > 0 ? "warning" : undefined} value={totals.down} />
          <Total label="Unassigned" value={totals.unassigned} />
        </View>

        <SegmentedControl
          accessibilityLabel="Filter fleet by type"
          onChange={setFilter}
          options={FILTER_OPTIONS}
          value={filter}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="truck" size={36} />}
            message="No units match this filter."
            title="Nothing here"
          />
        ) : (
          <View style={styles.cardGrid}>
            {visible.map((entry) => (
              <FleetCard
                entry={entry}
                key={entry.vehicle.id}
                onPress={() => router.push({
                  params: { id: entry.vehicle.id },
                  pathname: "/fleet/[id]",
                })}
              />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

export default FleetScreen;

function FleetCard({
  entry,
  onPress,
}: {
  readonly entry: FleetEntry;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { driver, expiringDocuments, openOrders, vehicle } = entry;

  return (
    <Card accessibilityLabel={`Open Unit ${vehicle.unitNumber}`} onPress={onPress} padding="none">
      <View style={styles.imageFrame}>
        {vehicle.thumbnailUrl ? (
          <Image
            accessibilityLabel={`${describeVehicle(vehicle)} thumbnail`}
            contentFit="cover"
            source={{ uri: vehicle.thumbnailUrl }}
            style={styles.vehicleImage}
          />
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: theme.surfaceElevated }]}>
            <Feather
              color={theme.primaryLight}
              name={vehicle.type === "tractor" ? "truck" : "box"}
              size={ICON.xl}
            />
            <Text style={[styles.imageFallbackLabel, { color: theme.textMuted }]}>Add photo</Text>
          </View>
        )}
        <View style={styles.imageBadge}>
          <Badge
            label={VEHICLE_STATUS_LABELS[vehicle.status]}
            size="sm"
            tone={statusBadgeTone(vehicle.status)}
          />
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <View style={styles.grow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Unit {vehicle.unitNumber}</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              {describeVehicle(vehicle)} · {formatOdometer(vehicle.odometerMiles)}
            </Text>
          </View>
          <Feather color={theme.textMuted} name="chevron-right" size={ICON.md} />
        </View>
        <View style={styles.cardFooter}>
          {driver ? (
            <View style={styles.driverRow}>
              <DriverAvatar driver={driver} ring={false} size={24} />
              <Text numberOfLines={1} style={[styles.driverName, { color: theme.textMuted }]}>
                {driverFullName(driver)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.driverName, { color: theme.textMuted }]}>Unassigned</Text>
          )}
          {openOrders.length > 0 || expiringDocuments.length > 0 ? (
            <View style={styles.flagRow}>
              {openOrders.length > 0 ? <Flag icon="tool" label={`${openOrders.length} open`} tone={theme.warning} /> : null}
              {expiringDocuments.length > 0 ? <Flag icon="file-text" label={`${expiringDocuments.length} expiring`} tone={theme.danger} /> : null}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function Flag({
  icon,
  label,
  tone,
}: {
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly tone: string;
}) {
  return (
    <View style={styles.flag}>
      <Feather color={tone} name={icon} size={ICON.xs} />
      <Text style={[styles.flagLabel, { color: tone }]}>{label}</Text>
    </View>
  );
}

function Total({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: "warning";
  readonly value: number;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${value} ${label}`}
      style={[styles.total, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text
        style={[
          styles.totalValue,
          { color: tone === "warning" && value > 0 ? theme.warning : theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function statusBadgeTone(status: VehicleStatus) {
  const tone = vehicleStatusTone(status);
  return tone === "neutral" ? "neutral" : tone;
}

const styles = StyleSheet.create({
  cardBody: { gap: SPACE.sm, padding: SPACE.md },
  cardFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 28 },
  cardGrid: { gap: SPACE.md },
  cardSubtitle: { ...TYPO.caption, marginTop: 3 },
  cardTitle: { ...TYPO.cardTitle },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  driverName: { ...TYPO.subtitle, maxWidth: 150 },
  driverRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xxs },
  fill: { flex: 1 },
  flag: { alignItems: "center", flexDirection: "row", gap: 2 },
  flagLabel: { ...TYPO.subtitle, fontSize: 10 },
  flagRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs },
  grow: { flex: 1, minWidth: 0 },
  imageBadge: { bottom: SPACE.sm, left: SPACE.sm, position: "absolute" },
  imageFallback: { alignItems: "center", flex: 1, gap: SPACE.xs, justifyContent: "center" },
  imageFallbackLabel: { ...TYPO.subtitle },
  imageFrame: { height: 156, overflow: "hidden", position: "relative" },
  total: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: SPACE.md,
  },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric },
  totalsRow: { flexDirection: "row", gap: SPACE.sm },
  vehicleImage: { height: "100%", width: "100%" },
});
