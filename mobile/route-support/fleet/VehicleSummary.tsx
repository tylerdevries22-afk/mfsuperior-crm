import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { AnimatedButton, Badge, Card, KeyValueRow, SectionHeader } from "@/components/ui";
import { ICON } from "@/theme";
import { VEHICLE_STATUS_LABELS, describeVehicle, formatOdometer, vehicleStatusTone } from "./utils";
import { milesToNextService } from "@/route-support/maintenance/utils";
import { Text, View } from "react-native";
import { styles } from "./detailStyles";
import type { VehicleDetailModel } from "./useVehicleDetail";
export function VehicleSummary({ model }: { readonly model: VehicleDetailModel }) {
  const { vehicle, theme, maintenanceOrders, thumbnailBusy, chooseThumbnail, thumbnailError } = model;
  const remainingMiles = milesToNextService(vehicle, maintenanceOrders);
  return <>
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
                  name={vehicle.type === "trailer" ? "box" : "truck"}
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
          <KeyValueRow label="Type" value={vehicle.type === "trailer" ? "Trailer" : "Truck"} />
          <KeyValueRow isLast label="Year" value={String(vehicle.year)} />
        </Card>

  </>;
}
