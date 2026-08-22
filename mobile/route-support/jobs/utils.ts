import type {
  AvailabilityBlock,
  AvailabilityRule,
  Driver,
  EntityId,
  Shipment,
  ShipmentStatus,
} from "@/domain/types";
import { blocksForDay, dayKeysBetween, isBlocking } from "@/route-support/availability/utils";
import { orderedStops, scheduledStart } from "@/route-support/schedule/utils";

/**
 * The dispatch board.
 *
 * Lanes are the questions a dispatcher actually asks, in the order they ask
 * them: what has nobody accepted, what has nobody driving, what is moving, and
 * what is finished. A load appears in exactly one lane.
 */

export const JOB_LANES = ["tendered", "unassigned", "active", "closed"] as const;

export type JobLane = (typeof JOB_LANES)[number];

export const JOB_LANE_LABELS: Record<JobLane, string> = {
  active: "In progress",
  closed: "Closed",
  tendered: "Awaiting response",
  unassigned: "Needs a driver",
};

const ACTIVE_STATUSES = new Set<ShipmentStatus>([
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
  "exception",
]);

const CLOSED_STATUSES = new Set<ShipmentStatus>(["delivered", "cancelled", "declined"]);

export function laneFor(shipment: Shipment): JobLane {
  if (CLOSED_STATUSES.has(shipment.status)) {
    return "closed";
  }
  if (shipment.status === "tendered") {
    return "tendered";
  }
  if (ACTIVE_STATUSES.has(shipment.status)) {
    return "active";
  }
  // Accepted but nobody is driving it.
  return shipment.assignedDriverId ? "active" : "unassigned";
}

export interface JobEntry {
  readonly shipment: Shipment;
  readonly driver: Driver | null;
  readonly lane: JobLane;
  readonly origin: string;
  readonly destination: string;
  readonly startsAt: string | null;
  readonly hasOpenException: boolean;
}

export function buildJobEntries(
  shipments: readonly Shipment[],
  drivers: readonly Driver[],
  openExceptionShipmentIds: ReadonlySet<EntityId>,
): readonly JobEntry[] {
  const driversById = new Map<EntityId, Driver>(drivers.map((driver) => [driver.id, driver]));

  return shipments
    .map((shipment) => {
      const stops = orderedStops(shipment);
      return {
        destination: stops[stops.length - 1]?.address.city ?? "Destination",
        driver: shipment.assignedDriverId
          ? driversById.get(shipment.assignedDriverId) ?? null
          : null,
        hasOpenException: openExceptionShipmentIds.has(shipment.id),
        lane: laneFor(shipment),
        origin: stops[0]?.address.city ?? "Origin",
        shipment,
        startsAt: scheduledStart(shipment),
      };
    })
    .sort((left, right) => {
      // Exceptions first inside a lane; they are the loads that need a human.
      if (left.hasOpenException !== right.hasOpenException) {
        return left.hasOpenException ? -1 : 1;
      }
      const leftStart = left.startsAt ? Date.parse(left.startsAt) : Number.MAX_SAFE_INTEGER;
      const rightStart = right.startsAt ? Date.parse(right.startsAt) : Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart;
    });
}

export function entriesInLane(
  entries: readonly JobEntry[],
  lane: JobLane,
): readonly JobEntry[] {
  return entries.filter((entry) => entry.lane === lane);
}

export function laneCounts(entries: readonly JobEntry[]): Record<JobLane, number> {
  return {
    active: entriesInLane(entries, "active").length,
    closed: entriesInLane(entries, "closed").length,
    tendered: entriesInLane(entries, "tendered").length,
    unassigned: entriesInLane(entries, "unassigned").length,
  };
}

/**
 * Drivers who can take this load, most obviously available first. Suspended
 * drivers are excluded outright: dispatch should not be able to assign one by
 * scrolling past the warning.
 */
export function assignableDrivers(
  drivers: readonly Driver[],
  blockedDriverIds: ReadonlySet<EntityId>,
): readonly Driver[] {
  const rank: Record<string, number> = { available: 0, off_duty: 2, on_duty: 1 };
  return drivers
    .filter((driver) => driver.status !== "suspended")
    .sort((left, right) => {
      const leftBlocked = blockedDriverIds.has(left.id) ? 1 : 0;
      const rightBlocked = blockedDriverIds.has(right.id) ? 1 : 0;
      if (leftBlocked !== rightBlocked) {
        return leftBlocked - rightBlocked;
      }
      return (rank[left.status] ?? 3) - (rank[right.status] ?? 3);
    });
}

/**
 * Drivers whose own calendar says they cannot work a load's window.
 *
 * Standing weekly patterns count, not just one-off blocks: a driver who is off
 * every Sunday is off this Sunday, and showing them as free would be the
 * calendar failing at the one job it has. They stay selectable — dispatch may
 * know something the calendar does not — but the clash is stated before the tap.
 */
export function driversBlockedFor(
  drivers: readonly Driver[],
  blocks: readonly AvailabilityBlock[],
  rules: readonly AvailabilityRule[],
  startsAt: string | null,
  endsAt: string | null,
): ReadonlySet<EntityId> {
  const blocked = new Set<EntityId>();
  if (!startsAt || !endsAt) {
    return blocked;
  }
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return blocked;
  }

  const dayKeys = dayKeysBetween(startsAt, endsAt);
  for (const driver of drivers) {
    const driverBlocks = blocks.filter((block) => block.driverId === driver.id);
    const driverRules = rules.filter((rule) => rule.driverId === driver.id);

    const clashes = dayKeys.some((dateKey) => blocksForDay(driverBlocks, driverRules, dateKey)
      .filter((block) => isBlocking(block.kind))
      .some((block) => Date.parse(block.startsAt) < end && Date.parse(block.endsAt) > start));
    if (clashes) {
      blocked.add(driver.id);
    }
  }
  return blocked;
}
