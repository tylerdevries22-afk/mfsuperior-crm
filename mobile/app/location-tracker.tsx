import { Ionicons } from "@expo/vector-icons";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, Header, KeyValueRow, Screen, SectionHeader } from "@/components/ui";
import type { GeoPoint } from "@/domain/types";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function LocationTrackerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentAccount, effectiveRole, activeShipment, state, error: operationError, actions } = useOperations();
  const driverId = currentAccount?.driverId ?? state.drivers[0]?.id;
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  const [tracking, setTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [position, setPosition] = useState<GeoPoint | null>(driver?.currentLocation ?? null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let active = true;
    if (Platform.OS !== "web") {
      Battery.getBatteryLevelAsync().then(
        (level) => { if (active && level >= 0) setBatteryPercent(Math.round(level * 100)); },
        () => { if (active) setBatteryPercent(null); },
      );
    }
    return () => {
      active = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  if (effectiveRole !== "driver") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="GPS tracking" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Return home" description="Switch to the Driver demo role to start optional foreground GPS tracking." onAction={() => router.replace("/(tabs)")} title="Driver role required" />
        </Screen>
      </View>
    );
  }

  const startTracking = async () => {
    setPermissionError(null);
    setIsStarting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPermissionError("Foreground location permission was not granted. The seeded demo position remains available.");
        return;
      }
      subscriptionRef.current?.remove();
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 250,
          timeInterval: 30_000,
        },
        (location) => {
          const coordinates = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setPosition(coordinates);
          setAccuracy(location.coords.accuracy);
          void actions.simulateDriverLocation(coordinates);
        },
      );
      setTracking(true);
    } catch {
      setPermissionError("Location services could not be started. The seeded demo position remains available.");
    } finally {
      setIsStarting(false);
    }
  };

  const stopTracking = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setTracking(false);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Foreground only" title="GPS tracking" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

        <Card>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: tracking ? theme.success : theme.textMuted }]} />
            <View style={styles.grow}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>{tracking ? "Tracking active" : "Tracking off"}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>{tracking ? "Balanced accuracy · foreground only" : "No device location is being requested"}</Text>
            </View>
            {batteryPercent !== null ? <Badge label={`${batteryPercent}% battery`} tone={batteryPercent < 20 ? "warning" : "neutral"} /> : null}
          </View>
        </Card>

        <Card padding="none" style={styles.mapCard}>
          <View style={[styles.mapCanvas, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.roadOne, { backgroundColor: theme.borderLight }]} />
            <View style={[styles.roadTwo, { backgroundColor: theme.borderLight }]} />
            <View style={[styles.positionPulse, { backgroundColor: theme.infoMuted }]}>
              <View style={[styles.positionMarker, { backgroundColor: theme.info, borderColor: theme.surface }]}>
                <Ionicons color={theme.textInverse} name="navigate" size={ICON.lg} />
              </View>
            </View>
            <Badge label={activeShipment?.loadNumber ?? "No active load"} tone="info" style={styles.mapBadge} />
          </View>
          <View style={styles.coordinateBlock}>
            <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>LAST LOCAL POSITION</Text>
            <Text style={[styles.coordinates, { color: theme.text }]}>{position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : "Position unavailable"}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{accuracy !== null ? `Device accuracy ±${Math.round(accuracy)} m` : `Seeded demo position · ${driver?.locationUpdatedAt ? new Date(driver.locationUpdatedAt).toLocaleString() : "not updated"}`}</Text>
          </View>
        </Card>

        <Button
          fullWidth
          icon={<Ionicons color={tracking ? theme.danger : theme.primaryForeground} name={tracking ? "stop" : "play"} size={ICON.md} />}
          loading={isStarting}
          onPress={tracking ? stopTracking : () => void startTracking()}
          title={tracking ? "Stop tracking" : "Start foreground tracking"}
          variant={tracking ? "danger" : "primary"}
        />

        {permissionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{permissionError}</Text> : null}
        {operationError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{operationError.message}</Text> : null}

        <SectionHeader title="Tracking policy" />
        <Card padding="none">
          <KeyValueRow label="Scope" value="Foreground only" />
          <KeyValueRow label="Interval" value="30 seconds or 250 meters" />
          <KeyValueRow label="Destination" value="Local prototype state" />
          <KeyValueRow isLast label="Target connection" value="Not connected" />
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  coordinateBlock: { gap: SPACE.xs, padding: SPACE.lg },
  coordinates: { ...TYPO.metric, fontVariant: ["tabular-nums"] },
  errorText: { ...TYPO.captionStrong },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xxs },
  mapBadge: { left: SPACE.md, position: "absolute", top: SPACE.md },
  mapCanvas: { height: 220, overflow: "hidden", position: "relative" },
  mapCard: { overflow: "hidden" },
  positionMarker: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 3, height: 50, justifyContent: "center", width: 50 },
  positionPulse: { alignItems: "center", borderRadius: RADIUS.pill, height: 86, justifyContent: "center", left: "50%", marginLeft: -43, marginTop: -43, position: "absolute", top: "50%", width: 86 },
  roadOne: { height: 5, left: -20, position: "absolute", right: -20, top: 112, transform: [{ rotate: "-17deg" }] },
  roadTwo: { bottom: -20, left: 124, position: "absolute", top: -20, transform: [{ rotate: "24deg" }], width: 4 },
  statusDot: { borderRadius: RADIUS.pill, height: 12, width: 12 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  statusTitle: { ...TYPO.cardTitle },
});
