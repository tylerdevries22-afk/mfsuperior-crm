import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";
import { AppModal, BottomSheet, Button, ListRow, StatusBadge, TextArea } from "@/components/ui";
import type { AppRole, ShipmentStatus, ShipmentStop } from "@/domain/types";
import { formatAppointment } from "@/lib/operations-format";
import { ICON, useTheme } from "@/theme";
import { styles } from "./styles";

interface Props {
  shipmentStatus: ShipmentStatus;
  role: AppRole;
  selectedStop: ShipmentStop | null;
  setSelectedStop: (stop: ShipmentStop | null) => void;
  busyAction: string | null;
  advanceIntermediate: (stop: ShipmentStop) => Promise<void>;
  resolutionVisible: boolean;
  setResolutionVisible: (visible: boolean) => void;
  resolutionNote: string;
  setResolutionNote: (note: string) => void;
  resumeStatus: ShipmentStatus;
  resolveOpenException: () => Promise<void>;
  declineVisible: boolean;
  setDeclineVisible: (visible: boolean) => void;
  onDecline: () => Promise<boolean>;
  run: (key: string, operation: () => Promise<boolean>) => Promise<boolean>;
  assignmentKind: "driver" | null;
  setAssignmentKind: (kind: "driver" | null) => void;
  assignmentCandidates: readonly { id: string; title: string; subtitle: string }[];
  selectAssignment: (id: string) => void;
  selectedDriverId: string;
}
export function LoadDetailModals(props: Props) {
  const theme = useTheme();
  const { shipmentStatus, role, selectedStop, setSelectedStop, busyAction, advanceIntermediate, resolutionVisible, setResolutionVisible, resolutionNote, setResolutionNote, resumeStatus, resolveOpenException, declineVisible, setDeclineVisible, onDecline, run, assignmentKind, setAssignmentKind, assignmentCandidates, selectAssignment, selectedDriverId } = props;
  return <>
  <BottomSheet
    footer={selectedStop && selectedStop.type === "intermediate" && shipmentStatus === "in_transit" && role !== "customer" && selectedStop.status !== "completed" ? (
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
          onPress={() => void run("decline", () => onDecline()).then((succeeded) => { if (succeeded) setDeclineVisible(false); })}
          title="Decline tender"
          variant="danger"
        />
      </View>
    }
    onClose={() => setDeclineVisible(false)}
    title="Decline this tender?"
    visible={declineVisible}
  >
    <Text style={[styles.body, { color: theme.textSecondary }]}>This records a 990 decline and removes the load from the active workflow.</Text>
  </AppModal>

  <BottomSheet
    onClose={() => setAssignmentKind(null)}
    title="Select driver"
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
          trailing={candidate.id === selectedDriverId
            ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} />
            : undefined}
        />
      ))}
    </View>
  </BottomSheet>
  </>;
}
