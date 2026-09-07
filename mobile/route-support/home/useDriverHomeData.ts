import { useMemo } from "react";

import type { Driver, Shipment, Vehicle } from "@/domain/types";
import { formatDateKey, scheduledStart } from "@/route-support/schedule/utils";

const CLOSED = new Set(["delivered", "declined", "cancelled"]);

export interface DriverHomeData {
  readonly completedToday: number;
  readonly driver: Driver | undefined;
  readonly offers: readonly Shipment[];
  readonly payCents: number;
  readonly todayLoads: readonly Shipment[];
  readonly upNext: readonly Shipment[];
  readonly vehicle: Vehicle | undefined;
}

/**
 * The driver's own slice of the board. Everything derives from `mine` — the
 * loads assigned to this driver — so an unassigned account sees empty lists
 * rather than the whole fleet's work.
 */
export function useDriverHomeData(
  driverId: string | undefined,
  drivers: readonly Driver[],
  shipments: readonly Shipment[],
  vehicles: readonly Vehicle[],
): DriverHomeData {
  const driver = drivers.find((item) => item.id === driverId);
  const vehicle = vehicles.find((item) => item.assignedDriverId === driverId);

  const mine = useMemo(
    () => (driverId ? shipments.filter((shipment) => shipment.assignedDriverId === driverId) : []),
    [driverId, shipments],
  );

  const todayKey = formatDateKey(new Date());
  const todayLoads = useMemo(
    () =>
      mine.filter((shipment) => {
        const start = scheduledStart(shipment);
        return start !== null && formatDateKey(new Date(start)) === todayKey;
      }),
    [mine, todayKey],
  );
  const completedToday = todayLoads.filter((shipment) => shipment.status === "delivered").length;
  const upNext = useMemo(
    () =>
      [...mine]
        .filter((shipment) => !CLOSED.has(shipment.status) && scheduledStart(shipment) !== null)
        .sort((a, b) => (scheduledStart(a) ?? "").localeCompare(scheduledStart(b) ?? "")),
    [mine],
  );
  const payCents = useMemo(
    () =>
      todayLoads.reduce(
        (total, { charges }) =>
          total + charges.linehaulCents + charges.fuelSurchargeCents + charges.accessorialsCents,
        0,
      ),
    [todayLoads],
  );
  const offers = useMemo(() => mine.filter((shipment) => shipment.status === "accepted"), [mine]);

  return { completedToday, driver, offers, payCents, todayLoads, upNext, vehicle };
}
