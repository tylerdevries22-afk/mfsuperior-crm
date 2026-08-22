import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Badge,
  Card,
  EmptyState,
  Header,
  KeyValueRow,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  statusLabel,
  StatusBadge,
} from "@/components/ui";
import {
  VEHICLE_STATUS_LABELS,
  describeVehicle,
  formatOdometer,
  vehicleStatusTone,
} from "@/route-support/fleet/utils";
import {
  DOCUMENT_KIND_LABELS,
  bucketFor,
  daysUntil,
  describeRemaining,
} from "@/route-support/licensing/utils";
import {
  MAINTENANCE_SEVERITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  milesToNextService,
} from "@/route-support/maintenance/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { ICON, SPACE, TYPO, useTheme } from "@/theme";

export default function VehicleDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    actions,
    complianceDocuments,
    effectiveRole,
    maintenanceOrders,
    state,
    vehicles,
  } = useOperations();

  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState(false);

  const vehicle = useMemo(
    () => vehicles.find((candidate) => candidate.id === id) ?? null,
    [id, vehicles],
  );
  const driver = useMemo(
    () => vehicle?.assignedDriverId
      ? state.drivers.find((candidate) => candidate.id === vehicle.assignedDriverId) ?? null
      : null,
    [state.drivers, vehicle],
  );
  const orders = useMemo(
    () => maintenanceOrders
      .filter((order) => order.vehicleId === id)
      .sort((left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt)),
    [id, maintenanceOrders],
  );
  const documents = useMemo(
    () => complianceDocuments
      .filter((document) => document.subjectType === "vehicle" && document.subjectId === id)
      .sort((left, right) => Date.parse(left.expiresOn) - Date.parse(right.expiresOn)),
    [complianceDocuments, id],
  );

  const assign = useCallback(async (driverId: string | null) => {
    if (!vehicle) {
      return;
    }
    setBusy(true);
    const assigned = await actions.assignVehicle(vehicle.id, driverId);
    setBusy(false);
    if (assigned) {
      setAssigning(false);
    }
  }, [actions, vehicle]);

  if (effectiveRole !== "admin" || !vehicle) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Vehicle" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="truck" size={36} />}
            message={effectiveRole === "admin"
              ? "That unit is no longer in the fleet."
              : "The fleet register is a dispatch console. Switch to an admin account to open it."}
            title={effectiveRole === "admin" ? "Unit not found" : "Admin role required"}
          />
        </Screen>
      </View>
    );
  }

  const remainingMiles = milesToNextService(vehicle, maintenanceOrders);
  const canAssign = vehicle.status === "active";

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={describeVehicle(vehicle)}
        title={`Unit ${vehicle.unitNumber}`}
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <View style={styles.headRow}>
            <Badge
              label={VEHICLE_STATUS_LABELS[vehicle.status]}
              tone={vehicleStatusTone(vehicle.status)}
            />
            <Text style={[styles.odometer, { color: theme.text }]}>
              {formatOdometer(vehicle.odometerMiles)}
            </Text>
          </View>
          <View style={[styles.serviceRow, { borderTopColor: theme.border }]}>
            <Feather
              color={remainingMiles !== null && remainingMiles <= 0 ? theme.danger : theme.textMuted}
              name="tool"
              size={ICON.sm}
            />
            <Text style={[styles.serviceText, { color: theme.textSecondary }]}>
              {remainingMiles === null
                ? "No preventive service on file for this unit"
                : remainingMiles <= 0
                  ? `Preventive service overdue by ${Math.abs(remainingMiles).toLocaleString()} mi`
                  : `${remainingMiles.toLocaleString()} mi to the next preventive service`}
            </Text>
          </View>
        </Card>

        <SectionHeader title="Assignment" />
        <Card>
          {driver ? (
            <View style={styles.driverRow}>
              <DriverAvatar driver={driver} size={44} />
              <View style={styles.grow}>
                <Text style={[styles.driverName, { color: theme.text }]}>
                  {driverFullName(driver)}
                </Text>
                <Text style={[styles.driverMeta, { color: theme.textMuted }]}>{driver.phone}</Text>
              </View>
              <StatusBadge size="sm" status={driver.status} />
            </View>
          ) : (
            <Text style={[styles.unassigned, { color: theme.textSecondary }]}>
              No driver on this unit.
            </Text>
          )}
          <AnimatedButton
            accessibilityLabel={driver ? "Change the assigned driver" : "Assign a driver"}
            disabled={!canAssign}
            fullWidth
            onPress={() => setAssigning(true)}
            size="sm"
            title={driver ? "Change driver" : "Assign a driver"}
            variant="outline"
          />
          {canAssign ? null : (
            <Text style={[styles.blockedNote, { color: theme.textMuted }]}>
              A unit that is {VEHICLE_STATUS_LABELS[vehicle.status].toLowerCase()} cannot be
              assigned. Close its work orders first.
            </Text>
          )}
        </Card>

        <SectionHeader title="Identification" />
        <Card padding="none">
          <KeyValueRow label="VIN" value={vehicle.vin} />
          <KeyValueRow label="Plate" value={`${vehicle.plateNumber} · ${vehicle.plateState}`} />
          <KeyValueRow label="Type" value={vehicle.type === "tractor" ? "Tractor" : "Trailer"} />
          <KeyValueRow isLast label="Year" value={String(vehicle.year)} />
        </Card>

        <SectionHeader
          action="Open shop"
          onAction={() => router.push("/maintenance")}
          title="Work orders"
        />
        {orders.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
              No work orders on this unit.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {orders.map((order, index) => (
              <ListRow
                isLast={index === orders.length - 1}
                key={order.id}
                onPress={() => router.push({
                  params: { id: order.id },
                  pathname: "/maintenance/[id]",
                })}
                subtitle={`${MAINTENANCE_SEVERITY_LABELS[order.severity]} · opened ${new Date(order.openedAt).toLocaleDateString()}`}
                title={order.summary}
                trailing={<StatusBadge size="sm" status={MAINTENANCE_STATUS_LABELS[order.status]} />}
              />
            ))}
          </Card>
        )}

        <SectionHeader
          action="All documents"
          onAction={() => router.push("/licensing")}
          title="Registration & inspection"
        />
        {documents.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
              No documents recorded for this unit.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {documents.map((document, index) => {
              const remaining = daysUntil(document.expiresOn);
              const bucket = bucketFor(remaining);
              return (
                <ListRow
                  isLast={index === documents.length - 1}
                  key={document.id}
                  subtitle={document.identifier}
                  title={DOCUMENT_KIND_LABELS[document.kind]}
                  trailing={
                    <Text
                      style={[
                        styles.expiry,
                        {
                          color: bucket === "expired"
                            ? theme.danger
                            : bucket === "urgent" ? theme.warning : theme.textMuted,
                        },
                      ]}
                    >
                      {describeRemaining(remaining)}
                    </Text>
                  }
                />
              );
            })}
          </Card>
        )}
      </Screen>

      {assigning ? (
        <Sheet onClose={() => setAssigning(false)} title="Assign a driver" visible>
          <View style={styles.sheetBody}>
            {driver ? (
              <ListRow
                leading={<Feather color={theme.danger} name="user-x" size={ICON.md} />}
                onPress={() => void assign(null)}
                subtitle="Leave this unit unassigned"
                title="Remove current driver"
              />
            ) : null}
            {state.drivers.map((candidate, index) => (
              <ListRow
                disabled={busy}
                isLast={index === state.drivers.length - 1}
                key={candidate.id}
                leading={<DriverAvatar driver={candidate} ring={false} size={36} />}
                onPress={() => void assign(candidate.id)}
                subtitle={statusLabel(candidate.status)}
                title={driverFullName(candidate)}
                trailing={candidate.id === driver?.id
                  ? <Feather color={theme.primaryLight} name="check" size={ICON.md} />
                  : undefined}
              />
            ))}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blockedNote: { ...TYPO.subtitle, lineHeight: 16 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  driverMeta: { ...TYPO.caption, marginTop: 2 },
  driverName: { ...TYPO.rowTitle },
  driverRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  emptyNote: { ...TYPO.body },
  expiry: { ...TYPO.subtitle, maxWidth: 120, textAlign: "right" },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  headRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  odometer: { ...TYPO.metric, fontSize: 22, lineHeight: 26 },
  serviceRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACE.xs,
    paddingTop: SPACE.sm,
  },
  serviceText: { ...TYPO.caption, flex: 1 },
  sheetBody: { paddingBottom: SPACE.md },
  unassigned: { ...TYPO.body },
});
