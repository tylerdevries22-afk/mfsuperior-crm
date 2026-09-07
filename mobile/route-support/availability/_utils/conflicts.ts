import type { EntityId, Shipment } from "@/domain/types";
import { orderedStops, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";

/**
 * Loads that run through a span the driver is marking as blocked.
 *
 * This never prevents the write. A driver telling dispatch they cannot work is
 * information dispatch needs, and refusing to record it would push the truth
 * out of the system. Surfacing the clash is the point.
 */
export function findAvailabilityConflicts(
  loads: readonly Shipment[],
  driverId: EntityId,
  startsAt: string,
  endsAt: string,
): readonly Shipment[] {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return loads.filter((load) => {
    if (load.assignedDriverId !== driverId) {
      return false;
    }
    if (load.status === "delivered" || load.status === "cancelled" || load.status === "declined") {
      return false;
    }
    const loadStart = scheduledStart(load);
    const loadEnd = scheduledEnd(load) ?? loadStart;
    if (!loadStart || !loadEnd) {
      return false;
    }
    return Date.parse(loadStart) < end && Date.parse(loadEnd) > start;
  });
}

/** A one-line route summary for a conflicting load. */
export function loadRouteLabel(load: Shipment): string {
  const stops = orderedStops(load);
  const origin = stops[0]?.address.city ?? "Origin";
  const destination = stops[stops.length - 1]?.address.city ?? "Destination";
  return `${origin} → ${destination}`;
}
