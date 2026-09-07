import Feather from "@expo/vector-icons/Feather";
import { View } from "react-native";
import { EmptyState, Header, Screen } from "@/components/ui";
import { styles } from "@/route-support/fleet/detailStyles";
import { useVehicleDetail } from "@/route-support/fleet/useVehicleDetail";
import { VehicleSummary } from "@/route-support/fleet/VehicleSummary";
import { VehicleRecords } from "@/route-support/fleet/VehicleRecords";
import { VehicleAssignment } from "@/route-support/fleet/VehicleAssignment";
import { VehicleAssignmentSheets } from "@/route-support/fleet/VehicleAssignmentSheets";
import { describeVehicle } from "@/route-support/fleet/utils";

export default function VehicleDetailScreen() {
  const detail = useVehicleDetail();
  const { router, theme, vehicle, effectiveRole } = detail;
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

  const model = { ...detail, vehicle };
  return <View style={[styles.fill, { backgroundColor: theme.background }]}>
    <Header onBack={() => router.back()} showBack subtitle={describeVehicle(vehicle)} title={`Unit ${vehicle.unitNumber}`} />
    <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
      <VehicleSummary model={model} />
      <VehicleRecords model={model} />
      <VehicleAssignment model={model} />
    </Screen>
    <VehicleAssignmentSheets model={model} />
  </View>;
}
