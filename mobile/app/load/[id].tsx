import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { Button, Card, EmptyState, Header, ListRow, Screen } from "@/components/ui";
import type { AppRole, ShipmentStatus, ShipmentStop } from "@/domain/types";
import { loadLifecycleAction } from "@/lib/load-actions";
import { LoadFlowBar } from "@/route-support/load/_components/LoadFlowBar";
import { useOperations } from "@/store";
import { ICON, useTheme } from "@/theme";
import { LoadRecords, LoadSummary } from "@/route-support/load/detail/LoadRecords";
import { LoadDetailModals } from "@/route-support/load/detail/LoadDetailModals";
import { MilestoneFooter } from "@/route-support/load/detail/MilestoneFooter";
import { styles } from "@/route-support/load/detail/styles";

const RESUMABLE_STATUSES = new Set<ShipmentStatus>([
  "dispatched", "at_pickup", "loaded", "in_transit", "at_delivery",
]);

export default function LoadDetailScreen() {
  const router = useRouter();
  const compactHeight = useWindowDimensions().height < 400;
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
  const [assignmentKind, setAssignmentKind] = useState<"driver" | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const shipmentEdi = useMemo(
    () => state.ediTransactions.filter((transaction) => transaction.shipmentId === shipment?.id),
    [shipment?.id, state.ediTransactions],
  );

  if (!shipment) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Load details" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Open schedule" description="This load is unavailable for the current membership." onAction={() => router.replace("/(tabs)/schedule")} title="Load not found" />
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
  const selectedDriver = state.drivers.find((driver) => driver.id === selectedDriverId);
  const reservedStatuses = new Set(["accepted", "dispatched", "at_pickup", "loaded", "in_transit", "at_delivery"]);
  const driverCandidates = state.drivers.filter((driver) => driver.status !== "suspended" && !state.shipments.some((candidate) =>
    candidate.id !== shipment.id
    && candidate.assignedDriverId === driver.id
    && reservedStatuses.has(candidate.status)));
  const assignmentCandidates = driverCandidates.map((driver) => ({
    id: driver.id,
    title: `${driver.firstName} ${driver.lastName}`,
    subtitle: `${driver.status} · CDL-${driver.licenseClass}`,
  }));

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
    setAssignmentKind(null);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.loadNumber} title="Load details" />
      {!compactHeight ? <LoadFlowBar status={shipment.status} /> : null}
      <Screen safeEdges={lifecycleAction || (nextIntermediateStop && role !== "customer") ? ["left", "right"] : ["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        {compactHeight ? <LoadFlowBar status={shipment.status} /> : null}
        {error ? (
          <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium }]}>
            <Ionicons color={theme.danger} name="alert-circle-outline" size={ICON.md} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text>
            <Button onPress={actions.clearError} size="sm" title="Dismiss" variant="ghost" />
          </View>
        ) : null}

        <LoadSummary shipment={shipment} />
        {role === "admin" && shipment.status === "tendered" ? (
          <Card title="Tender response">
            <Text style={[styles.body, { color: theme.textSecondary }]}>Review the lane and rate before returning the 990 response.</Text>
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
          <Card title="Driver">
            <Text style={[styles.body, { color: theme.textSecondary }]}>Assign a driver before dispatching the load.</Text>
            <View style={[styles.assignmentList, { borderColor: theme.border }]}>
              <ListRow
                isLast
                onPress={() => setAssignmentKind("driver")}
                subtitle={selectedDriver ? `${selectedDriver.status} · CDL-${selectedDriver.licenseClass}` : "Required before dispatch"}
                title={selectedDriver ? `${selectedDriver.firstName} ${selectedDriver.lastName}` : "Select driver"}
              />
            </View>
            <Button
              disabled={!selectedDriverId}
              fullWidth
              loading={busyAction === "assign"}
              onPress={() => void run("assign", () => actions.assignShipment(shipment.id, selectedDriverId))}
              title={shipment.assignedDriverId ? "Save assignment" : "Assign load"}
              variant="secondary"
            />
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

        <LoadRecords shipment={shipment} proof={proof} shipmentEdi={shipmentEdi} setSelectedStop={setSelectedStop} onRoutePlan={() => router.push({ pathname: "/route-planner/[id]", params: { id: shipment.id } })} />
      </Screen>
      <MilestoneFooter action={lifecycleAction} intermediateStop={role !== "customer" ? nextIntermediateStop : undefined} busyAction={busyAction} hasDriver={Boolean(shipment.assignedDriverId)} onAdvance={() => void runLifecycleAction()} onAdvanceStop={advanceIntermediate} />
      <LoadDetailModals
        shipmentStatus={shipment.status} role={role} selectedStop={selectedStop} setSelectedStop={setSelectedStop}
        busyAction={busyAction} advanceIntermediate={advanceIntermediate} resolutionVisible={resolutionVisible}
        setResolutionVisible={setResolutionVisible} resolutionNote={resolutionNote} setResolutionNote={setResolutionNote}
        resumeStatus={resumeStatus} resolveOpenException={resolveOpenException} declineVisible={declineVisible}
        setDeclineVisible={setDeclineVisible} onDecline={() => actions.respondToTender(shipment.id, "declined")}
        run={run} assignmentKind={assignmentKind} setAssignmentKind={setAssignmentKind}
        assignmentCandidates={assignmentCandidates} selectAssignment={selectAssignment} selectedDriverId={selectedDriverId}
      />
    </View>
  );
}
