import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
  TextArea,
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
  const [transferring, setTransferring] = useState(false);
  const [transferDriverId, setTransferDriverId] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

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

  const transfer = useCallback(async () => {
    if (!vehicle || !transferDriverId) return;
    setBusy(true);
    const succeeded = await actions.transferVehicle(vehicle.id, transferDriverId, transferNote);
    setBusy(false);
    if (succeeded) {
      setTransferring(false);
      setTransferDriverId(null);
      setTransferNote("");
    }
  }, [actions, transferDriverId, transferNote, vehicle]);

  const chooseThumbnail = useCallback(async () => {
    if (!vehicle) return;
    setThumbnailError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setThumbnailError("Photo-library access is needed to add a vehicle thumbnail.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        mediaTypes: ["images"],
        quality: 0.82,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      setThumbnailBusy(true);
      const succeeded = await actions.updateVehicleThumbnail(vehicle.id, {
        contentType: thumbnailContentType(asset.mimeType, asset.fileName),
        fileName: asset.fileName ?? `unit-${vehicle.unitNumber}.jpg`,
        uri: asset.uri,
      });
      setThumbnailBusy(false);
      if (!succeeded) setThumbnailError("The vehicle thumbnail could not be saved. Try again.");
    } catch {
      setThumbnailBusy(false);
      setThumbnailError("The photo could not be added. Try another image.");
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
  const transferCandidates = state.drivers.filter((candidate) => candidate.id !== driver?.id);

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
        <Card padding="none">
          <View style={styles.detailImageFrame}>
            {vehicle.thumbnailUrl ? (
              <Image
                accessibilityLabel={`${describeVehicle(vehicle)} thumbnail`}
                contentFit="cover"
                source={{ uri: vehicle.thumbnailUrl }}
                style={styles.detailImage}
              />
            ) : (
              <View style={[styles.detailImageFallback, { backgroundColor: theme.surfaceElevated }]}>
                <Feather
                  color={theme.primaryLight}
                  name={vehicle.type === "tractor" ? "truck" : "box"}
                  size={ICON.xl}
                />
                <Text style={[styles.detailImageFallbackLabel, { color: theme.textMuted }]}>No thumbnail yet</Text>
              </View>
            )}
          </View>
          <View style={styles.thumbnailControls}>
            <View style={styles.grow}>
              <Text style={[styles.thumbnailTitle, { color: theme.text }]}>Vehicle thumbnail</Text>
              <Text style={[styles.thumbnailMeta, { color: theme.textMuted }]}>Shared with your fleet team</Text>
            </View>
            <AnimatedButton
              disabled={thumbnailBusy}
              loading={thumbnailBusy}
              onPress={() => void chooseThumbnail()}
              size="sm"
              title={vehicle.thumbnailUrl ? "Change photo" : "Add photo"}
              variant="secondary"
            />
          </View>
          {thumbnailError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
              {thumbnailError}
            </Text>
          ) : null}
        </Card>

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
            <Text style={[styles.unassigned, { color: theme.textSecondary }]}>No driver on this unit.</Text>
          )}
          <View style={styles.actionRow}>
            <AnimatedButton
              accessibilityLabel={driver ? "Change the assigned driver" : "Assign a driver"}
              disabled={!canAssign}
              onPress={() => setAssigning(true)}
              size="sm"
              style={styles.actionButton}
              title={driver ? "Change driver" : "Assign driver"}
              variant="outline"
            />
            <AnimatedButton
              accessibilityLabel="Transfer this vehicle to another driver"
              disabled={!canAssign || !driver}
              icon={<Feather color={theme.text} name="shuffle" size={ICON.sm} />}
              onPress={() => {
                setTransferDriverId(null);
                setTransferring(true);
              }}
              size="sm"
              style={styles.actionButton}
              title="Transfer"
              variant="secondary"
            />
          </View>
          {canAssign ? null : (
            <Text style={[styles.blockedNote, { color: theme.textMuted }]}>
              A unit that is {VEHICLE_STATUS_LABELS[vehicle.status].toLowerCase()} cannot be assigned.
              Close its work orders first.
            </Text>
          )}
        </Card>
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
      {transferring ? (
        <Sheet
          footer={(
            <AnimatedButton
              disabled={!transferDriverId}
              fullWidth
              loading={busy}
              onPress={() => void transfer()}
              title="Confirm transfer"
              variant="primary"
            />
          )}
          onClose={() => setTransferring(false)}
          title="Transfer vehicle"
          visible
        >
          <View style={styles.sheetBody}>
            <View style={[styles.transferSummary, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[styles.transferSummaryLabel, { color: theme.textMuted }]}>Moving</Text>
              <Text style={[styles.transferSummaryValue, { color: theme.text }]}>Unit {vehicle.unitNumber}</Text>
              <Text style={[styles.transferSummaryLabel, { color: theme.textMuted }]}>Current driver</Text>
              <Text style={[styles.transferSummaryValue, { color: theme.text }]}>
                {driver ? driverFullName(driver) : "Unassigned"}
              </Text>
            </View>
            <TextArea
              helperText="The receiving driver will see this note in the transfer notification."
              label="Transfer notes (optional)"
              maxLength={1000}
              onChangeText={setTransferNote}
              placeholder="Add context for the receiving driver..."
              value={transferNote}
            />
            <Text style={[styles.sheetSectionLabel, { color: theme.text }]}>Transfer to</Text>
            {transferCandidates.length === 0 ? (
              <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>No other drivers are available.</Text>
            ) : transferCandidates.map((candidate, index) => (
              <ListRow
                disabled={busy}
                isLast={index === transferCandidates.length - 1}
                key={candidate.id}
                leading={<DriverAvatar driver={candidate} ring={false} size={36} />}
                onPress={() => setTransferDriverId(candidate.id)}
                subtitle={statusLabel(candidate.status)}
                title={driverFullName(candidate)}
                trailing={candidate.id === transferDriverId
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

function thumbnailContentType(mimeType: string | undefined, fileName: string | null | undefined): string {
  const normalized = mimeType?.toLowerCase();
  if (normalized === "image/heic" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  if (normalized === "image/jpeg") return normalized;
  return fileName?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  actionRow: { flexDirection: "row", gap: SPACE.sm },
  blockedNote: { ...TYPO.subtitle, lineHeight: 16 },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  detailImage: { height: "100%", width: "100%" },
  detailImageFallback: { alignItems: "center", flex: 1, gap: SPACE.xs, justifyContent: "center" },
  detailImageFallbackLabel: { ...TYPO.subtitle },
  detailImageFrame: { borderTopLeftRadius: 16, borderTopRightRadius: 16, height: 190, overflow: "hidden" },
  driverMeta: { ...TYPO.caption, marginTop: 2 },
  driverName: { ...TYPO.rowTitle },
  driverRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  emptyNote: { ...TYPO.body },
  error: { ...TYPO.subtitle, paddingBottom: SPACE.md, paddingHorizontal: SPACE.lg },
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
  sheetSectionLabel: { ...TYPO.captionStrong, marginBottom: SPACE.xs, marginTop: SPACE.md },
  thumbnailControls: { alignItems: "center", flexDirection: "row", gap: SPACE.md, padding: SPACE.md },
  thumbnailMeta: { ...TYPO.subtitle, marginTop: 2 },
  thumbnailTitle: { ...TYPO.rowTitle },
  transferSummary: { borderRadius: 12, gap: SPACE.xxs, padding: SPACE.md },
  transferSummaryLabel: { ...TYPO.caption },
  transferSummaryValue: { ...TYPO.body, marginBottom: SPACE.xs },
  unassigned: { ...TYPO.body },
});
