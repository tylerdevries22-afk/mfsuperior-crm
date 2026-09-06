import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { DriverAvatar } from "@/components/operations/DriverAvatar";
import { Badge, Card } from "@/components/ui";
import { SPACE, TYPO, useTheme } from "@/theme";
import { describeVehicle, formatOdometer, VEHICLE_STATUS_LABELS, vehicleStatusTone, type FleetEntry } from "./utils";

/** A complete fleet record in a compact, wrapping row with a leading thumbnail. */
export function FleetRow({ entry, onPress }: { readonly entry: FleetEntry; readonly onPress: () => void }) {
  const theme = useTheme();
  const { vehicle, driver, openOrders, expiringDocuments } = entry;
  return (
    <Card accessibilityLabel={`Open Unit ${vehicle.unitNumber}`} onPress={onPress} padding="none">
      <View style={styles.row}>
        <View style={[styles.thumbnail, { backgroundColor: theme.surfaceElevated }]}>
          {vehicle.thumbnailUrl ? <Image accessibilityLabel={`Unit ${vehicle.unitNumber} thumbnail`} contentFit="cover" source={{ uri: vehicle.thumbnailUrl }} style={styles.image} /> : <Feather color={theme.primaryLight} name={vehicle.type === "trailer" ? "box" : "truck"} size={28} />}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Unit {vehicle.unitNumber}</Text>
            <Feather color={theme.textMuted} name="chevron-right" size={18} />
          </View>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{describeVehicle(vehicle)}</Text>
          <Text style={[styles.detail, { color: theme.textMuted }]}>{formatOdometer(vehicle.odometerMiles)}</Text>
          <View style={styles.flags}>
            <Badge label={VEHICLE_STATUS_LABELS[vehicle.status]} tone={vehicleStatusTone(vehicle.status)} />
            {openOrders.length > 0 ? <Badge label={`${openOrders.length} open`} tone="warning" /> : null}
            {expiringDocuments.length > 0 ? <Badge label={`${expiringDocuments.length} expiring`} tone="danger" /> : null}
          </View>
          <View style={styles.driver}>
            {driver ? <DriverAvatar driver={driver} ring={false} size={22} /> : null}
            <Text style={[styles.driverName, { color: theme.textSecondary }]}>{driver ? `${driver.firstName} ${driver.lastName}` : "Unassigned"}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12 },
  thumbnail: { width: 64, height: 64, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  image: { width: "100%", height: "100%" },
  body: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  title: { ...TYPO.cardTitle, flex: 1 },
  detail: { ...TYPO.subtitle, lineHeight: 17 },
  flags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 4 },
  driver: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  driverName: { ...TYPO.subtitle, flexShrink: 1 },
});
