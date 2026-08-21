import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { StopTimeline } from "@/components/operations";
import { Badge, Button, Card, EmptyState, Header, KeyValueRow, Screen, SectionHeader } from "@/components/ui";
import { formatMinutes, shipmentRoute } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function RoutePlannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useTheme();
  const { effectiveRole, shipments } = useOperations();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const shipment = shipments.find((candidate) => candidate.id === id);

  if (!shipment) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Route plan" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Back to schedule" description="The requested load is not available to this account." onAction={() => router.replace("/(tabs)/schedule")} title="Route unavailable" />
        </Screen>
      </View>
    );
  }

  const firstStop = shipment.stops[0];
  const lastStop = shipment.stops.at(-1);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle={shipment.loadNumber} title="Route plan" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

        <Card padding="none" style={styles.mapCard}>
          <View style={[styles.mapCanvas, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.routeLine, { backgroundColor: theme.borderLight }]} />
            {shipment.stops.map((stop, index) => (
              <View key={stop.id} style={[styles.mapStop, { left: `${18 + index * (64 / Math.max(1, shipment.stops.length - 1))}%` }]}>
                <View style={[styles.mapPin, { backgroundColor: index === shipment.stops.length - 1 ? theme.success : theme.primary }]}>
                  <Text style={[styles.mapPinText, { color: index === shipment.stops.length - 1 ? theme.textInverse : theme.primaryForeground }]}>{index + 1}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.mapLabel, { color: theme.textSecondary }]}>{stop.address.city}</Text>
              </View>
            ))}
            <View style={[styles.currentMarker, { backgroundColor: theme.info, borderColor: theme.surface }]}>
              <Ionicons color={theme.textInverse} name="navigate" size={ICON.sm} />
            </View>
          </View>
          <View style={styles.mapSummary}>
            <View style={styles.grow}>
              <Text style={[styles.routeTitle, { color: theme.text }]}>{shipmentRoute(shipment)}</Text>
              <Text style={[styles.routeMeta, { color: theme.textSecondary }]}>{shipment.distanceMiles} mi · {formatMinutes(shipment.estimatedDurationMinutes)} planned</Text>
            </View>
            <Badge label={`${shipment.stops.length} stops`} tone="info" />
          </View>
        </Card>

        <View style={styles.actionRow}>
          {effectiveRole !== "customer" ? <Button fullWidth onPress={() => router.push("/location-tracker")} title="Open GPS tracking" /> : null}
          <Button fullWidth onPress={() => router.push({ pathname: "/load/[id]", params: { id: shipment.id } })} title="Load details" variant="secondary" />
        </View>

        <SectionHeader title="Route summary" />
        <Card padding="none">
          <KeyValueRow label="Origin" value={firstStop ? `${firstStop.facilityName} · ${firstStop.address.city}, ${firstStop.address.state}` : "Pending"} />
          <KeyValueRow label="Destination" value={lastStop ? `${lastStop.facilityName} · ${lastStop.address.city}, ${lastStop.address.state}` : "Pending"} />
          <KeyValueRow label="Equipment" value={shipment.equipmentType.replaceAll("_", " ")} />
          <KeyValueRow isLast label="Freight" value={`${shipment.weightPounds.toLocaleString()} lb · ${shipment.palletCount} pallets`} />
        </Card>

        <SectionHeader title="Stops" />
        <Card>
          <StopTimeline stops={shipment.stops} />
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { gap: SPACE.sm },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  currentMarker: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 3, height: 34, justifyContent: "center", left: "42%", position: "absolute", top: 82, width: 34 },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xxs },
  mapCanvas: { height: 220, overflow: "hidden", position: "relative" },
  mapCard: { overflow: "hidden" },
  mapLabel: { ...TYPO.subtitle, maxWidth: 72, textAlign: "center" },
  mapPin: { alignItems: "center", borderRadius: RADIUS.pill, height: 34, justifyContent: "center", width: 34 },
  mapPinText: { ...TYPO.captionStrong },
  mapStop: { alignItems: "center", gap: SPACE.xs, marginLeft: -34, position: "absolute", top: 116, width: 68 },
  mapSummary: { alignItems: "center", flexDirection: "row", gap: SPACE.md, padding: SPACE.lg },
  routeLine: { height: 4, left: "18%", position: "absolute", right: "18%", top: 131 },
  routeMeta: { ...TYPO.caption },
  routeTitle: { ...TYPO.cardTitle },
});
