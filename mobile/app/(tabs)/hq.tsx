import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { DriverAvatar, LiveMap, type MapMarker } from "@/components/operations";
import { AnimatedPressable, EmptyState, Header, StatusBadge } from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { MapBottomSheet } from "@/route-support/hq/_components/MapBottomSheet";
import { driverFullName, orderedStops } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { FONTS, THEME } from "@/theme";

/**
 * HQ — the live operating picture.
 *
 * Replaces the former Capacity tab, which was an equipment/asset register
 * (tractors, trailers, reefer units, stock). Freight operations do not run off
 * an equipment inventory here, so HQ answers the question that page never
 * did: where is everything right now.
 *
 * The map/sheet arrangement mirrors the actz-may marketplace: a full-bleed map
 * behind a draggable sheet that lists what the map is showing, with selection
 * synced both ways.
 */

const CLOSED = new Set(["delivered", "declined", "cancelled"]);

const STATUS_COLORS: Record<string, string> = {
  in_transit: THEME.primary,
  at_pickup: "#F59E0B",
  at_delivery: "#F59E0B",
  loaded: "#0EA5E9",
  dispatched: "#8B5CF6",
  exception: THEME.danger,
};

export default function HqScreen() {
  const router = useRouter();
  const { shipments, state } = useOperations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useMemo(
    () => shipments.filter((shipment) => !CLOSED.has(shipment.status)),
    [shipments],
  );

  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((c) => [c.id, c])),
    [state.customers],
  );

  /**
   * Two marker sources: a driver's last reported position, and the pickup of a
   * load nobody is carrying yet. Both are things an operator needs to see on
   * the same picture.
   */
  const markers = useMemo<readonly MapMarker[]>(() => {
    const driverPins: MapMarker[] = state.drivers.map((driver) => ({
      id: `driver:${driver.id}`,
      latitude: driver.currentLocation.latitude,
      longitude: driver.currentLocation.longitude,
      label: driverFullName(driver),
      sublabel: driver.status.replaceAll("_", " "),
      color: driver.status === "on_duty" ? THEME.primary : THEME.textMuted,
      active: selectedId === `driver:${driver.id}`,
    }));

    const loadPins = active
      .filter((shipment) => !shipment.assignedDriverId)
      .map((shipment): MapMarker | null => {
        const pickup = orderedStops(shipment).find((stop) => stop.type === "pickup");
        if (!pickup) return null;
        return {
          id: `load:${shipment.id}`,
          latitude: pickup.coordinates.latitude,
          longitude: pickup.coordinates.longitude,
          label: shipment.loadNumber,
          sublabel: `${pickup.address.city} · awaiting driver`,
          color: STATUS_COLORS[shipment.status] ?? THEME.textSecondary,
          active: selectedId === `load:${shipment.id}`,
        };
      })
      .filter((pin): pin is MapMarker => pin !== null);

    return [...driverPins, ...loadPins];
  }, [active, selectedId, state.drivers]);

  const openLoad = useCallback(
    (id: string) => router.push({ pathname: "/load/[id]", params: { id } }),
    [router],
  );

  const onTrack = active.filter((shipment) => shipment.status === "in_transit").length;
  const unassigned = active.filter((shipment) => !shipment.assignedDriverId).length;

  return (
    <View style={styles.fill}>
      <Header subtitle="Live operating picture" title="HQ" />
      <LiveMap
        bottomInsetRatio={0.5}
        markers={markers}
        onSelectMarker={setSelectedId}
        selectedId={selectedId}
      />

      <MapBottomSheet
        subtitle={`${state.drivers.length} drivers · ${onTrack} in transit · ${unassigned} awaiting a driver`}
        title="Live network"
      >
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>DRIVERS</Text>
          {state.drivers.map((driver) => {
            const carrying = active.find((s) => s.assignedDriverId === driver.id);
            return (
              <AnimatedPressable
                accessibilityLabel={`${driverFullName(driver)} on the map`}
                accessibilityRole="button"
                haptic="selection"
                key={driver.id}
                onPress={() => setSelectedId(`driver:${driver.id}`)}
                style={[
                  styles.row,
                  selectedId === `driver:${driver.id}` && styles.rowSelected,
                ]}
              >
                <DriverAvatar driver={driver} ring={false} size={34} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{driverFullName(driver)}</Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>
                    {carrying
                      ? `${carrying.loadNumber} · ${carrying.status.replaceAll("_", " ")}`
                      : "No active load"}
                  </Text>
                </View>
                <StatusBadge showDot size="sm" status={driver.status} />
              </AnimatedPressable>
            );
          })}

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>AWAITING A DRIVER</Text>
          {unassigned === 0 ? (
            <EmptyState
              description="Every active load has a driver assigned."
              title="Nothing waiting"
            />
          ) : (
            active
              .filter((shipment) => !shipment.assignedDriverId)
              .map((shipment: Shipment) => (
                <AnimatedPressable
                  accessibilityLabel={`Open load ${shipment.loadNumber}`}
                  accessibilityRole="button"
                  haptic="selection"
                  key={shipment.id}
                  onPress={() => openLoad(shipment.id)}
                  style={styles.row}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      {customersById[shipment.customerId]?.companyName ?? shipment.loadNumber}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowMeta}>
                      {shipment.loadNumber} · {shipment.equipmentType.replaceAll("_", " ")}
                    </Text>
                  </View>
                  <StatusBadge showDot size="sm" status={shipment.status} />
                </AnimatedPressable>
              ))
          )}
        </ScrollView>
      </MapBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: THEME.background, flex: 1 },
  row: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowMeta: { color: THEME.textMuted, fontFamily: FONTS.regular, fontSize: 12 },
  rowSelected: { backgroundColor: THEME.surfaceElevated },
  rowTitle: { color: THEME.text, fontFamily: FONTS.semibold, fontSize: 15 },
  sectionLabel: {
    color: THEME.textMuted,
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sheetBody: { paddingBottom: 120 },
});
