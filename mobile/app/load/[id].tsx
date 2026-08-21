import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProgressTrack, StopTimeline } from "@/components/operations";
import {
  AppModal,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Header,
  KeyValueRow,
  ListRow,
  Screen,
  SectionHeader,
  StatusBadge,
  TextArea,
} from "@/components/ui";
import type { AppRole, ShipmentStatus, ShipmentStop } from "@/domain/types";
import { formatAppointment, formatCurrency, shipmentProgress, shipmentRoute } from "@/lib/operations-format";
import { loadLifecycleAction } from "@/lib/load-actions";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const RESUMABLE_STATUSES = new Set<ShipmentStatus>([
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
]);

export default function LoadDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useTheme();
  const { currentAccount, effectiveRole, shipments, state, error, actions } = useOperations();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const shipment = shipments.find((candidate) => candidate.id === id);
  const role: AppRole = effectiveRole ?? currentAccount?.role ?? "customer";
  const [selectedStop, setSelectedStop] = useState<ShipmentStop | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [declineVisible, setDeclineVisible] = useState(false);
  const [resolutionVisible, setResolutionVisible] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [assignmentKind, setAssignmentKind] = useState<"driver" | "tractor" | "trailer" | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedTractorId, setSelectedTractorId] = useState("");
  const [selectedTrailerId, setSelectedTrailerId] = useState("");

  const shipmentEdi = useMemo(
    () => state.ediTransactions.filter((transaction) => transaction.shipmentId === shipment?.id),
    [shipment?.id, state.ediTransactions],
  );

  if (!shipment) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Load details" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Open schedule" description="This load is unavailable for the current demo role." onAction={() => router.replace("/(tabs)/schedule")} title="Load not found" />
        </Screen>
      </View>
    );
  }

  const lifecycleAction = loadLifecycleAction(shipment.status, role);
  const nextIntermediateStop = shipment.status === "in_transit"
    ? shipment.stops.find((stop) => stop.type === "intermediate" && stop.status !== "completed" && stop.status !== "skipped")
    : undefined;
  const proof = state.proofsOfDelivery.find((candidate) => candidate.shipmentId === shipment.id);
  const openException = state.exceptions.find((report) => report.shipmentId === shipment.id && report.status !== "resolved");
  const resumeStatus = [...shipment.events]
    .reverse()
    .map((event) => event.resultingStatus)
    .find((status): status is ShipmentStatus => Boolean(status && RESUMABLE_STATUSES.has(status))) ?? "dispatched";
  const chargeTotal = shipment.charges.linehaulCents + shipment.charges.fuelSurchargeCents + shipment.charges.accessorialsCents;
  const selectedDriver = state.drivers.find((driver) => driver.id === selectedDriverId);
  const selectedTractor = state.equipment.find((equipment) => equipment.id === selectedTractorId);
  const selectedTrailer = state.equipment.find((equipment) => equipment.id === selectedTrailerId);
  const reservedStatuses = new Set(["accepted", "dispatched", "at_pickup", "loaded", "in_transit", "at_delivery"]);
  const driverCandidates = state.drivers.filter((driver) => driver.status !== "suspended" && !state.shipments.some((candidate) =>
    candidate.id !== shipment.id
    && candidate.assignedDriverId === driver.id
    && reservedStatuses.has(candidate.status)));
  const equipmentCandidates = state.equipment.filter((equipment) => {
    const reservedElsewhere = state.shipments.some((candidate) =>
      candidate.id !== shipment.id
      && reservedStatuses.has(candidate.status)
      && (candidate.assignedTractorId === equipment.id || candidate.assignedTrailerId === equipment.id));
    const compatible = equipment.kind !== "trailer" || equipment.compatibleEquipmentType === shipment.equipmentType;
    return !reservedElsewhere && compatible && !["maintenance", "out_of_service"].includes(equipment.status);
  });
  const assignmentCandidates = assignmentKind === "driver"
    ? driverCandidates.map((driver) => ({ id: driver.id, title: `${driver.firstName} ${driver.lastName}`, subtitle: `${driver.status} · CDL-${driver.licenseClass}` }))
    : equipmentCandidates
        .filter((equipment) => equipment.kind === assignmentKind)
        .map((equipment) => ({ id: equipment.id, title: equipment.name, subtitle: `${equipment.assetNumber} · ${equipment.status}` }));

  const run = async (key: string, operation: () => Promise<boolean>) => {
    setBusyAction(key);
    const succeeded = await operation();
    setBusyAction(null);
    return succeeded;
  };

  const runLifecycleAction = async () => {
    if (!lifecycleAction) return;
    if (lifecycleAction.kind === "proof_of_delivery") {
      router.push({ pathname: "/proof-of-delivery/[id]", params: { id: shipment.id } });
      return;
    }
    const nextStatus = lifecycleAction.nextStatus;
    if (nextStatus) {
      await run(nextStatus, () => actions.transitionShipment(shipment.id, nextStatus));
    }
  };

  const advanceIntermediate = async (stop: ShipmentStop) => {
    const succeeded = await run(`stop-${stop.id}`, () => actions.advanceIntermediateStop(shipment.id, stop.id));
    if (succeeded) setSelectedStop(null);
  };

  const resolveOpenException = async () => {
    if (!openException || resolutionNote.trim().length < 5) return;
    const succeeded = await run("resolve-exception", () => actions.resolveException(openException.id, resolutionNote, resumeStatus));
    if (succeeded) {
      setResolutionNote("");
      setResolutionVisible(false);
    }
  };

  const selectAssignment = (candidateId: string) => {
    if (assignmentKind === "driver") setSelectedDriverId(candidateId);
    if (assignmentKind === "tractor") setSelectedTractorId(candidateId);
    if (assignmentKind === "trailer") setSelectedTrailerId(candidateId);
    setAssignmentKind(null);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.loadNumber} title="Load details" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

        {error ? (
          <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium }]}>
            <Ionicons color={theme.danger} name="alert-circle-outline" size={ICON.md} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text>
            <Button onPress={actions.clearError} size="sm" title="Dismiss" variant="ghost" />
          </View>
        ) : null}

        <Card>
          <View style={styles.loadHeader}>
            <View style={styles.grow}>
              <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>FREIGHT LOAD</Text>
              <Text style={[styles.title, { color: theme.text }]}>{shipment.loadNumber}</Text>
              <Text style={[styles.route, { color: theme.textSecondary }]}>{shipmentRoute(shipment)}</Text>
            </View>
            <StatusBadge size="md" status={shipment.status} />
          </View>
          <ProgressTrack value={shipmentProgress(shipment.status)} tone={shipment.status === "exception" ? "warning" : "brand"} />
          <View style={styles.badges}>
            <Badge label={shipment.equipmentType.replaceAll("_", " ")} tone="info" />
            <Badge label={`${shipment.weightPounds.toLocaleString()} lb`} />
            <Badge label={`${shipment.palletCount} pallets`} />
            {shipment.temperatureFahrenheit !== undefined ? <Badge label={`${shipment.temperatureFahrenheit}°F`} tone="warning" /> : null}
          </View>
        </Card>

        {role === "admin" && shipment.status === "tendered" ? (
          <Card title="Tender response">
            <Text style={[styles.body, { color: theme.textSecondary }]}>Review the lane and rate before returning the simulated 990 response.</Text>
            <View style={styles.actionRow}>
              <Button
                fullWidth
                loading={busyAction === "accept"}
                onPress={() => void run("accept", () => actions.respondToTender(shipment.id, "accepted"))}
                title="Accept tender"
              />
              <Button fullWidth onPress={() => setDeclineVisible(true)} title="Decline" variant="danger" />
            </View>
          </Card>
        ) : null}

        {role === "admin" && (shipment.status === "accepted" || shipment.status === "dispatched") ? (
          <Card title="Driver & equipment">
            <Text style={[styles.body, { color: theme.textSecondary }]}>Assign the people and assets before dispatching the load.</Text>
            <View style={[styles.assignmentList, { borderColor: theme.border }]}>
              <ListRow
                onPress={() => setAssignmentKind("driver")}
                subtitle={selectedDriver ? `${selectedDriver.status} · CDL-${selectedDriver.licenseClass}` : "Required before dispatch"}
                title={selectedDriver ? `${selectedDriver.firstName} ${selectedDriver.lastName}` : "Select driver"}
              />
              <ListRow
                onPress={() => setAssignmentKind("tractor")}
                subtitle={selectedTractor?.assetNumber ?? "Optional"}
                title={selectedTractor?.name ?? "Select tractor"}
              />
              <ListRow
                isLast
                onPress={() => setAssignmentKind("trailer")}
                subtitle={selectedTrailer?.assetNumber ?? "Optional"}
                title={selectedTrailer?.name ?? "Select trailer"}
              />
            </View>
            <Button
              disabled={!selectedDriverId || !selectedTrailerId}
              fullWidth
              loading={busyAction === "assign"}
              onPress={() => void run("assign", () => actions.assignShipment(shipment.id, selectedDriverId, selectedTractorId || undefined, selectedTrailerId || undefined))}
              title={shipment.assignedDriverId ? "Save assignment" : "Assign load"}
              variant="secondary"
            />
          </Card>
        ) : null}

        {nextIntermediateStop && role !== "customer" ? (
          <Card title="Next route milestone">
            <Text style={[styles.body, { color: theme.textSecondary }]}>{nextIntermediateStop.facilityName} · {formatAppointment(nextIntermediateStop.appointment)}</Text>
            <Button
              fullWidth
              loading={busyAction === `stop-${nextIntermediateStop.id}`}
              onPress={() => void advanceIntermediate(nextIntermediateStop)}
              title={nextIntermediateStop.status === "pending" ? "Arrive at intermediate stop" : "Complete intermediate stop"}
            />
          </Card>
        ) : lifecycleAction && !(lifecycleAction.nextStatus === "dispatched" && !shipment.assignedDriverId) ? (
          <Card title="Next milestone">
            <Button fullWidth loading={busyAction === lifecycleAction.nextStatus} onPress={() => void runLifecycleAction()} title={lifecycleAction.label} />
          </Card>
        ) : null}

        {shipment.status === "exception" ? (
          <Card variant="tinted">
            <View style={styles.noticeRow}>
              <Ionicons color={theme.warning} name="warning-outline" size={ICON.lg} />
              <View style={styles.grow}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>Load is in exception</Text>
                <Text style={[styles.body, { color: theme.textSecondary }]}>{openException?.description ?? "Dispatch must review the open report before this shipment can resume."}</Text>
              </View>
            </View>
            {role === "admin" && openException ? (
              <Button fullWidth onPress={() => setResolutionVisible(true)} title={`Resolve and resume ${resumeStatus.replaceAll("_", " ")}`} variant="secondary" />
            ) : null}
          </Card>
        ) : null}

        {role !== "customer" && !["delivered", "declined", "cancelled"].includes(shipment.status) ? (
          <View style={styles.secondaryActions}>
            <Button fullWidth onPress={() => router.push({ pathname: "/route-planner/[id]", params: { id: shipment.id } })} title="Open route plan" variant="secondary" />
            <Button fullWidth onPress={() => router.push({ pathname: "/exception/new", params: { shipmentId: shipment.id } })} title="Report exception" variant="outline" />
          </View>
        ) : null}

        <SectionHeader title="Load information" />
        <Card padding="none">
          <KeyValueRow label="Purchase order" value={shipment.purchaseOrderNumber} />
          <KeyValueRow label="Bill of lading" value={shipment.billOfLadingNumber} />
          <KeyValueRow label="PRO number" value={shipment.proNumber} />
          <KeyValueRow label="Distance" value={`${shipment.distanceMiles.toLocaleString()} miles`} />
          <KeyValueRow label="Commodity" value={shipment.commodity} />
          <KeyValueRow isLast label="Prototype charges" value={formatCurrency(chargeTotal)} />
        </Card>

        <SectionHeader title="Special instructions" />
        <Card>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{shipment.specialInstructions}</Text>
        </Card>

        <SectionHeader action="Route plan" onAction={() => router.push({ pathname: "/route-planner/[id]", params: { id: shipment.id } })} title="Stops" />
        <Card>
          <StopTimeline onStopPress={setSelectedStop} stops={shipment.stops} />
        </Card>

        {proof ? (
          <>
            <SectionHeader title="Proof of delivery" />
            <Card>
              <View style={styles.noticeRow}>
                <View style={[styles.successMark, { backgroundColor: theme.successMuted }]}>
                  <Ionicons color={theme.success} name="checkmark" size={ICON.md} />
                </View>
                <View style={styles.grow}>
                  <Text style={[styles.noticeTitle, { color: theme.text }]}>Received by {proof.recipientName}</Text>
                  <Text style={[styles.body, { color: theme.textSecondary }]}>{proof.attachments.length} attachment{proof.attachments.length === 1 ? "" : "s"} · {new Date(proof.submittedAt).toLocaleString()}</Text>
                </View>
                <StatusBadge status={proof.status} />
              </View>
            </Card>
          </>
        ) : null}

        <SectionHeader title="Milestone timeline" />
        <Card padding="none">
          {shipment.events.slice().reverse().map((event, index) => (
            <ListRow
              isLast={index === shipment.events.length - 1}
              key={event.id}
              meta={`${event.eventCode} · ${event.source}`}
              subtitle={new Date(event.occurredAt).toLocaleString()}
              title={event.description}
              trailing={event.resultingStatus ? <StatusBadge status={event.resultingStatus} /> : undefined}
            />
          ))}
        </Card>

        <SectionHeader title="EDI audit" />
        <Card padding="none">
          {shipmentEdi.map((transaction, index) => (
            <ListRow
              isLast={index === shipmentEdi.length - 1}
              key={transaction.id}
              meta={`${transaction.direction} · ${transaction.controlNumber}`}
              subtitle={transaction.summary}
              title={`${transaction.transactionType} transaction`}
              trailing={<StatusBadge status={transaction.status} />}
            />
          ))}
        </Card>
      </Screen>

      <BottomSheet
        footer={selectedStop && selectedStop.type === "intermediate" && shipment.status === "in_transit" && role !== "customer" && selectedStop.status !== "completed" ? (
          <Button
            fullWidth
            loading={busyAction === `stop-${selectedStop.id}`}
            onPress={() => void advanceIntermediate(selectedStop)}
            title={selectedStop.status === "pending" ? "Mark arrived" : "Complete stop"}
          />
        ) : undefined}
        onClose={() => setSelectedStop(null)}
        title={selectedStop?.facilityName ?? "Stop details"}
        visible={selectedStop !== null}
      >
        {selectedStop ? (
          <View style={styles.sheetContent}>
            <StatusBadge status={selectedStop.status} />
            <Text style={[styles.sheetAddress, { color: theme.text }]}>{selectedStop.address.line1}{"\n"}{selectedStop.address.city}, {selectedStop.address.state} {selectedStop.address.postalCode}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{formatAppointment(selectedStop.appointment)}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{selectedStop.instructions}</Text>
          </View>
        ) : null}
      </BottomSheet>

      <AppModal
        footer={(
          <View style={styles.actionRow}>
            <Button fullWidth onPress={() => setResolutionVisible(false)} title="Keep open" variant="secondary" />
            <Button
              disabled={resolutionNote.trim().length < 5}
              fullWidth
              loading={busyAction === "resolve-exception"}
              onPress={() => void resolveOpenException()}
              title="Resolve exception"
            />
          </View>
        )}
        onClose={() => setResolutionVisible(false)}
        title="Resolve shipment exception"
        visible={resolutionVisible}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.body, { color: theme.textSecondary }]}>The load will resume in {resumeStatus.replaceAll("_", " ")} status and record a local resolution event.</Text>
          <TextArea label="Resolution note" maxLength={1000} onChangeText={setResolutionNote} placeholder="Describe what cleared the exception…" value={resolutionNote} />
        </View>
      </AppModal>

      <AppModal
        footer={
          <View style={styles.actionRow}>
            <Button fullWidth onPress={() => setDeclineVisible(false)} title="Keep tender" variant="secondary" />
            <Button
              fullWidth
              loading={busyAction === "decline"}
              onPress={() => void run("decline", () => actions.respondToTender(shipment.id, "declined")).then((succeeded) => { if (succeeded) setDeclineVisible(false); })}
              title="Decline tender"
              variant="danger"
            />
          </View>
        }
        onClose={() => setDeclineVisible(false)}
        title="Decline this tender?"
        visible={declineVisible}
      >
        <Text style={[styles.body, { color: theme.textSecondary }]}>This records a simulated 990 decline and removes the load from the active workflow.</Text>
      </AppModal>

      <BottomSheet
        onClose={() => setAssignmentKind(null)}
        title={assignmentKind ? `Select ${assignmentKind}` : "Select assignment"}
        visible={assignmentKind !== null}
      >
        <View style={styles.sheetContent}>
          {assignmentCandidates.map((candidate, index) => (
            <ListRow
              isLast={index === assignmentCandidates.length - 1}
              key={candidate.id}
              onPress={() => selectAssignment(candidate.id)}
              subtitle={candidate.subtitle}
              title={candidate.title}
              trailing={candidate.id === (assignmentKind === "driver" ? selectedDriverId : assignmentKind === "tractor" ? selectedTractorId : selectedTrailerId)
                ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} />
                : undefined}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { gap: SPACE.sm },
  assignmentList: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorBanner: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  errorText: { ...TYPO.captionStrong, flex: 1 },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xs, minWidth: 0 },
  loadHeader: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.md },
  noticeRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  noticeTitle: { ...TYPO.cardTitle },
  route: { ...TYPO.body },
  secondaryActions: { gap: SPACE.sm },
  sheetAddress: { ...TYPO.bodyStrong },
  sheetContent: { gap: SPACE.md, paddingBottom: SPACE.sm },
  successMark: { alignItems: "center", borderRadius: RADIUS.pill, height: 42, justifyContent: "center", width: 42 },
  title: { ...TYPO.screenTitle, fontSize: 34, lineHeight: 39 },
});
