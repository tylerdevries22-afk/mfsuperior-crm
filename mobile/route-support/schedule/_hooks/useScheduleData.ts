import { useMemo } from "react";

import type { Customer, Driver, Shipment } from "@/domain/types";
import { useOperations } from "@/store";

import {
  buildDriverColors,
  formatDateKey,
  getWeekDates,
  isLoadPast,
  scheduledStart,
} from "../utils";

/**
 * Ported from the Appliance Diagnostic Systems `useScheduleData` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. The reference fetches a date-keyed
 * schedule from its API; the freight app already holds every load in the
 * operations store, so the same shape is derived locally and stays correct
 * offline.
 */
export interface ScheduleData {
  readonly weekDates: readonly Date[];
  /** Loads grouped by local date key, each sorted by start time. */
  readonly schedule: Readonly<Record<string, readonly Shipment[]>>;
  readonly driverColors: Readonly<Record<string, string>>;
  readonly drivers: readonly Driver[];
  readonly customersById: Readonly<Record<string, Customer>>;
  readonly exceptionShipmentIds: ReadonlySet<string>;
  readonly isLoading: boolean;
}

export function useScheduleData(selectedDriverIds: readonly string[]): ScheduleData {
  const { currentAccount, effectiveRole, isHydrated, shipments, state } = useOperations();

  const weekDates = useMemo(() => getWeekDates(new Date()), []);

  const drivers = useMemo<readonly Driver[]>(() => state.drivers ?? [], [state.drivers]);

  const customersById = useMemo(
    () => Object.fromEntries((state.customers ?? []).map((c) => [c.id, c])),
    [state.customers],
  );

  const driverColors = useMemo(() => buildDriverColors(drivers), [drivers]);

  /**
   * A driver only ever sees their own loads. The driver chips are an admin
   * affordance layered on top of that, never a way around it.
   */
  const scoped = useMemo(() => {
    if (effectiveRole === "driver") {
      const driverId = currentAccount?.driverId;
      return driverId ? shipments.filter((s) => s.assignedDriverId === driverId) : [];
    }
    if (selectedDriverIds.length === 0) return shipments;
    const wanted = new Set(selectedDriverIds);
    return shipments.filter((s) =>
      s.assignedDriverId ? wanted.has(s.assignedDriverId) : wanted.has("unassigned"),
    );
  }, [currentAccount?.driverId, effectiveRole, selectedDriverIds, shipments]);

  const schedule = useMemo(() => {
    const grouped: Record<string, Shipment[]> = {};
    for (const shipment of scoped) {
      const start = scheduledStart(shipment);
      if (!start) continue;
      const key = formatDateKey(new Date(start));
      (grouped[key] ??= []).push(shipment);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        const left = scheduledStart(a) ?? "";
        const right = scheduledStart(b) ?? "";
        return left.localeCompare(right);
      });
    }
    return grouped;
  }, [scoped]);

  const exceptionShipmentIds = useMemo(
    () =>
      new Set(
        (state.exceptions ?? [])
          .filter((exception) => !exception.resolvedAt)
          .map((exception) => exception.shipmentId),
      ),
    [state.exceptions],
  );

  return {
    weekDates,
    schedule,
    driverColors,
    drivers,
    customersById,
    exceptionShipmentIds,
    isLoading: !isHydrated,
  };
}

export { isLoadPast };
