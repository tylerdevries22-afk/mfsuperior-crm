import Feather from "@expo/vector-icons/Feather";
import { DriverAvatar } from "@/components/operations/DriverAvatar";
import { AnimatedButton, Card, SectionHeader, StatusBadge } from "@/components/ui";
import { driverFullName } from "@/route-support/schedule/utils";
import { ICON } from "@/theme";
import { VEHICLE_STATUS_LABELS } from "./utils";
import { Text, View } from "react-native";
import { styles } from "./detailStyles";
import type { VehicleDetailModel } from "./useVehicleDetail";
export function VehicleAssignment({ model }: { readonly model: VehicleDetailModel }) {
  const { theme, vehicle, driver, setAssigning, setTransferDriverId, setTransferring } = model;
  const canAssign = vehicle.status === "active";
  return <>
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
  </>;
}
