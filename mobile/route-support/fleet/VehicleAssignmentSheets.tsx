import Feather from "@expo/vector-icons/Feather";
import { DriverAvatar } from "@/components/operations/DriverAvatar";
import { AnimatedButton, ListRow, Sheet, statusLabel, TextArea } from "@/components/ui";
import { driverFullName } from "@/route-support/schedule/utils";
import { ICON } from "@/theme";
import { Text, View } from "react-native";
import { styles } from "./detailStyles";
import type { VehicleDetailModel } from "./useVehicleDetail";
export function VehicleAssignmentSheets({ model }: { readonly model: VehicleDetailModel }) {
  const { theme, state, vehicle, driver, assigning, setAssigning, transferring, setTransferring, transferDriverId, setTransferDriverId, transferNote, setTransferNote, busy, assign, transfer } = model;
  const transferCandidates = state.drivers.filter((candidate) => candidate.id !== driver?.id);
  return <>
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
  </>;
}
