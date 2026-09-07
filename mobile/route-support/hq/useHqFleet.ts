import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlatList } from "react-native";

import type { MapMarker } from "@/components/operations";
import type { Customer, Shipment } from "@/domain/types";
import type { SheetPosition } from "@/route-support/hq/_components/MapBottomSheet";
import {
  BODY_COLORS,
  CLOSED,
  STATUS_COLORS,
  TICK_MS,
  type FleetRow,
} from "@/route-support/hq/constants";
import { FLEET, fleetPositions } from "@/route-support/hq/fleet-simulation";
import { useAvatarDataUris } from "@/route-support/hq/useAvatarDataUris";
import { driverFullName } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { THEME, useReducedMotion } from "@/theme";

export interface HqFleet {
  readonly customersById: Record<string, Customer>;
  readonly focusMarkerId: string | null;
  readonly listRef: React.RefObject<FlatList<FleetRow> | null>;
  readonly markers: readonly MapMarker[];
  readonly moving: number;
  readonly reduceMotion: boolean;
  readonly rows: readonly FleetRow[];
  readonly selectDriver: (driverId: string, options?: { readonly recentre?: boolean }) => void;
  readonly selectedId: string | null;
  readonly setSheetPosition: (position: SheetPosition) => void;
  readonly sheetPosition: SheetPosition;
  readonly unassigned: readonly Shipment[];
}

/**
 * The live operating picture's data: simulated demo movement, the driver rows
 * behind both the map markers and the sheet list, and the selection that keeps
 * the two in step.
 */
export function useHqFleet(): HqFleet {
  const { shipments, state } = useOperations();
  const reduceMotion = useReducedMotion();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("half");
  const [elapsed, setElapsed] = useState(0);
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

  const moving = rows.filter(({ driver }) => driver.status === "on_duty").length;
  const unassigned = active.filter((shipment) => !shipment.assignedDriverId);

  return {
    customersById,
    focusMarkerId,
    listRef,
    markers,
    moving,
    reduceMotion,
    rows,
    selectDriver,
    selectedId,
    setSheetPosition,
    sheetPosition,
    unassigned,
  };
}
