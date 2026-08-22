import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { DriverAvatar, LiveMap, type MapMarker } from "@/components/operations";
import { AnimatedPressable, EmptyState, Header, StatusBadge } from "@/components/ui";
import type { Driver, GeoPoint, Shipment } from "@/domain/types";
import { MapBottomSheet, type SheetPosition } from "@/route-support/hq/_components/MapBottomSheet";
import { FLEET, fleetPositions } from "@/route-support/hq/fleet-simulation";
import { useAvatarDataUris } from "@/route-support/hq/useAvatarDataUris";
import { driverFullName, orderedStops } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { FONTS, THEME, useReducedMotion } from "@/theme";

/**
 * HQ — the live operating picture.
 *
 * Replaces the former Capacity tab, which was an equipment/asset register.
 * Freight operations do not run off an equipment inventory here, so HQ answers
 * the question that page never did: where is everything right now.
 *
 * The map/sheet arrangement mirrors the actz-may marketplace: a full-bleed map
 * behind a draggable sheet listing what the map shows, selection synced both
 * ways — tapping a truck raises the sheet to that driver, tapping a row
 * recentres the map on their truck.
 */

const CLOSED = new Set(["delivered", "declined", "cancelled"]);
/**
 * Share of the map covered by the sheet at its half snap. The map sits below
 * the header while the sheet is measured against the whole screen, so this runs
 * a little past the raw 0.5 ratio; it only pads the camera, never the layout.
 */
const SHEET_INSET_RATIO = 0.56;
const TICK_MS = 1000;

/** Cosmetic fleet livery. Duty state rides on the status dot, never the body. */
const BODY_COLORS = { yellow: "#E8DE2A", white: "#F4F5F0" } as const;

const STATUS_COLORS: Record<string, string> = {
  on_duty: THEME.primary,
  available: THEME.success,
  off_duty: THEME.textMuted,
  suspended: THEME.danger,
};

type FleetRow = {
  readonly driver: Driver;
  readonly load?: Shipment;
  readonly position: GeoPoint;
};

export default function HqScreen() {
  const router = useRouter();
  const { shipments, state } = useOperations();
  const reduceMotion = useReducedMotion();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("half");
  const [elapsed, setElapsed] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const listRef = useRef<FlatList<FleetRow>>(null);

  const isDemo = state.accounts.some((account) => account.email.includes("@demo."));
  const avatarUris = useAvatarDataUris(state.drivers);

  /**
   * Movement is a demo affordance only. Production positions arrive through
   * `recordDriverLocation`, and inventing coordinates on a real operations map
   * would misreport where a driver actually is.
   */
  useEffect(() => {
    if (!isDemo || reduceMotion) return undefined;
    const timer = setInterval(() => setElapsed((value) => value + TICK_MS / 1000), TICK_MS);
    return () => clearInterval(timer);
  }, [isDemo, reduceMotion]);

  const active = useMemo(
    () => shipments.filter((shipment) => !CLOSED.has(shipment.status)),
    [shipments],
  );
  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((customer) => [customer.id, customer])),
    [state.customers],
  );

  const positions = useMemo(
    () => (isDemo ? fleetPositions(elapsed) : {}),
    [elapsed, isDemo],
  );

  const rows = useMemo<readonly FleetRow[]>(
    () =>
      state.drivers.map((driver) => ({
        driver,
        load: active.find((shipment) => shipment.assignedDriverId === driver.id),
        position: positions[driver.id] ?? driver.currentLocation,
      })),
    [active, positions, state.drivers],
  );

  const bodyFor = useCallback((driverId: string) => {
    const unit = FLEET.find((candidate) => candidate.driverId === driverId);
    return BODY_COLORS[unit?.bodyColor ?? "white"];
  }, []);

  const markers = useMemo<readonly MapMarker[]>(
    () =>
      rows.map(({ driver, load, position }) => ({
        id: driver.id,
        latitude: position.latitude,
        longitude: position.longitude,
        label: driverFullName(driver),
        sublabel: load ? `${load.loadNumber} · ${load.status.replaceAll("_", " ")}` : "No active load",
        color: bodyFor(driver.id),
        statusColor: STATUS_COLORS[driver.status] ?? THEME.textMuted,
        avatarUri: avatarUris[driver.id],
        active: selectedId === driver.id,
      })),
    [avatarUris, bodyFor, rows, selectedId],
  );

  /** Tapping a truck raises the sheet and brings that driver's row into view. */
  const selectDriver = useCallback(
    (driverId: string, options: { readonly recentre?: boolean } = {}) => {
      setSelectedId(driverId);
      if (options.recentre) setFocusId(`${driverId}:${Date.now()}`);
      setSheetPosition((current) => (current === "collapsed" ? "half" : current));
      const index = rows.findIndex((row) => row.driver.id === driverId);
      if (index >= 0) {
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: !reduceMotion });
          } catch {
            // scrollToIndex throws until the row is measured; the highlight
            // still lands, and the next render retries.
          }
        });
      }
    },
    [reduceMotion, rows],
  );

  const focusMarkerId = useMemo(() => focusId?.split(":")[0] ?? null, [focusId]);

  const openLoad = useCallback(
    (id: string) => router.push({ pathname: "/load/[id]", params: { id } }),
    [router],
  );

  const moving = rows.filter(({ driver }) => driver.status === "on_duty").length;
  const unassigned = active.filter((shipment) => !shipment.assignedDriverId);

  return (
    <View style={styles.fill}>
      <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <Header subtitle="Live operating picture" title="HQ" />
      </View>
      <LiveMap
        bottomInsetRatio={SHEET_INSET_RATIO}
        focusId={focusMarkerId}
        glideMs={reduceMotion ? 0 : TICK_MS}
        markers={markers}
        onSelectMarker={(id) => selectDriver(id)}
        selectedId={selectedId}
      />

      <MapBottomSheet
        onPositionChange={setSheetPosition}
        position={sheetPosition}
        subtitle={`${rows.length} trucks · ${moving} on duty · ${unassigned.length} awaiting a driver`}
        title="Live network"
        topInset={headerHeight}
      >
        <FlatList
          contentContainerStyle={styles.sheetBody}
          data={rows}
          keyExtractor={(row) => row.driver.id}
          ListFooterComponent={
            <View style={styles.footer}>
              <Text style={styles.sectionLabel}>AWAITING A DRIVER</Text>
              {unassigned.length === 0 ? (
                <EmptyState
                  description="Every active load has a driver assigned."
                  title="Nothing waiting"
                />
              ) : (
                unassigned.map((shipment) => {
                  const pickup = orderedStops(shipment).find((stop) => stop.type === "pickup");
                  return (
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
                          {shipment.loadNumber} · {pickup?.address.city ?? "Pickup pending"}
                        </Text>
                      </View>
                      <StatusBadge showDot size="sm" status={shipment.status} />
                    </AnimatedPressable>
                  );
                })
              )}
            </View>
          }
          ListHeaderComponent={<Text style={styles.sectionLabel}>FLEET</Text>}
          onScrollToIndexFailed={() => undefined}
          ref={listRef}
          renderItem={({ item }) => (
            <AnimatedPressable
              accessibilityLabel={`${driverFullName(item.driver)} on the map`}
              accessibilityRole="button"
              haptic="selection"
              onPress={() => selectDriver(item.driver.id, { recentre: true })}
              style={[styles.row, selectedId === item.driver.id && styles.rowSelected]}
            >
              <View>
                <DriverAvatar driver={item.driver} ring={false} size={34} />
                <View
                  style={[
                    styles.rowStatusDot,
                    { backgroundColor: STATUS_COLORS[item.driver.status] ?? THEME.textMuted },
                  ]}
                />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{driverFullName(item.driver)}</Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {item.load
                    ? `${item.load.loadNumber} · ${item.load.status.replaceAll("_", " ")}`
                    : "No active load"}
                </Text>
              </View>
              <StatusBadge showDot size="sm" status={item.driver.status} />
            </AnimatedPressable>
          )}
          showsVerticalScrollIndicator={false}
        />
      </MapBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: THEME.background, flex: 1 },
  footer: { marginTop: 18 },
  row: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowMeta: { color: THEME.textMuted, fontFamily: FONTS.regular, fontSize: 12 },
  rowSelected: { backgroundColor: THEME.surfaceElevated },
  rowStatusDot: {
    borderColor: THEME.surface,
    borderRadius: 5,
    borderWidth: 2,
    bottom: -1,
    height: 10,
    position: "absolute",
    right: -1,
    width: 10,
  },
  rowTitle: { color: THEME.text, fontFamily: FONTS.semibold, fontSize: 15 },
  sectionLabel: {
    color: THEME.textMuted,
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sheetBody: { paddingBottom: 140 },
});
