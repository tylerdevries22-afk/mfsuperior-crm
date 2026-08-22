import { DRIVER_LINEHAUL_SHARE, deliveryTime } from "@/domain/payouts";
import type { EntityId, Shipment } from "@/domain/types";
import { orderedStops } from "@/route-support/schedule/utils";

/**
 * Driver trip history.
 *
 * Earnings here use the same `DRIVER_LINEHAUL_SHARE` the settlement builder
 * uses, so a trip's figure and the payout that eventually contains it agree by
 * construction. This is an estimate of what the load earned, not a record of
 * what was paid — the payout ledger is the record.
 */

export const TRIP_PERIODS = ["week", "month", "all"] as const;

export type TripPeriod = (typeof TRIP_PERIODS)[number];

export const TRIP_PERIOD_LABELS: Record<TripPeriod, string> = {
  all: "All time",
  month: "This month",
  week: "This week",
};

export interface Trip {
  readonly shipment: Shipment;
  readonly deliveredAt: number;
  readonly miles: number;
  readonly durationMinutes: number;
  readonly earningsCents: number;
  readonly origin: string;
  readonly destination: string;
}

export interface TripTotals {
  readonly loads: number;
  readonly miles: number;
  readonly earningsCents: number;
  readonly onTimeRate: number | null;
}

/** Start of the window for a period, or null for all time. */
export function periodStart(period: TripPeriod, now: Date): number | null {
  if (period === "all") {
    return null;
  }
  if (period === "week") {
    // Sunday-aligned, matching the schedule's week and the settlement period.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return start.getTime();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export function buildTrips(
  shipments: readonly Shipment[],
  driverId: EntityId,
  period: TripPeriod,
  now: Date = new Date(),
): readonly Trip[] {
  const start = periodStart(period, now);
  const trips: Trip[] = [];

  for (const shipment of shipments) {
    if (shipment.assignedDriverId !== driverId || shipment.status !== "delivered") {
      continue;
    }
    const deliveredAt = deliveryTime(shipment);
    if (deliveredAt === null || (start !== null && deliveredAt < start)) {
      continue;
    }

    const stops = orderedStops(shipment);
    trips.push({
      deliveredAt,
      destination: stops[stops.length - 1]?.address.city ?? "Destination",
      durationMinutes: tripDurationMinutes(shipment),
      earningsCents: Math.round(shipment.charges.linehaulCents * DRIVER_LINEHAUL_SHARE) +
        shipment.charges.accessorialsCents,
      miles: shipment.distanceMiles,
      origin: stops[0]?.address.city ?? "Origin",
      shipment,
    });
  }

  // Most recent first: a driver checking their history is looking for the run
  // they just finished, not the one they did last spring.
  return trips.sort((left, right) => right.deliveredAt - left.deliveredAt);
}

export function summarizeTrips(trips: readonly Trip[]): TripTotals {
  let miles = 0;
  let earningsCents = 0;
  let onTime = 0;
  let measured = 0;

  for (const trip of trips) {
    miles += trip.miles;
    earningsCents += trip.earningsCents;
    const punctuality = wasOnTime(trip.shipment);
    if (punctuality !== null) {
      measured += 1;
      if (punctuality) {
        onTime += 1;
      }
    }
  }

  return {
    earningsCents,
    loads: trips.length,
    miles,
    onTimeRate: measured === 0 ? null : onTime / measured,
  };
}

/**
 * Real elapsed time from arriving at the first stop to completing the last.
 * Falls back to the planned window when a stop was never stamped, because a
 * trip with no recorded arrival still has a scheduled shape.
 */
export function tripDurationMinutes(shipment: Shipment): number {
  const stops = orderedStops(shipment);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) {
    return 0;
  }
  const startedAt = Date.parse(first.arrivedAt ?? first.appointment.startsAt);
  const endedAt = Date.parse(last.completedAt ?? last.appointment.endsAt);
  return Math.max(0, Math.round((endedAt - startedAt) / 60_000));
}

/** Whether the final delivery completed inside its appointment window. */
export function wasOnTime(shipment: Shipment): boolean | null {
  const stops = orderedStops(shipment);
  const last = stops[stops.length - 1];
  if (!last?.completedAt) {
    return null;
  }
  return Date.parse(last.completedAt) <= Date.parse(last.appointment.endsAt);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Cents to a plain dollar string. Whole dollars drop the trailing zeros. */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    style: "currency",
  });
}

/** Groups trips under a `Today · Mon Aug 24`-style heading. */
export function groupTripsByDay(trips: readonly Trip[]): readonly {
  readonly dateKey: string;
  readonly trips: readonly Trip[];
}[] {
  const groups = new Map<string, Trip[]>();
  for (const trip of trips) {
    const dateKey = new Date(trip.deliveredAt).toLocaleDateString("en-CA");
    const bucket = groups.get(dateKey);
    if (bucket) {
      bucket.push(trip);
    } else {
      groups.set(dateKey, [trip]);
    }
  }
  return [...groups.entries()]
    .map(([dateKey, grouped]) => ({ dateKey, trips: grouped }))
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}
