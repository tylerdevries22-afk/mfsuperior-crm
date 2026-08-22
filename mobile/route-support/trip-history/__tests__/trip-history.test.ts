import { createDemoOperationsState } from "@/domain/fixtures";
import { DRIVER_LINEHAUL_SHARE } from "@/domain/payouts";
import type { Shipment } from "@/domain/types";

import {
  buildTrips,
  formatCents,
  formatDuration,
  groupTripsByDay,
  periodStart,
  summarizeTrips,
  tripDurationMinutes,
  wasOnTime,
} from "../utils";

const state = createDemoOperationsState();
// The fixtures anchor to 2026-08-20; the delivered load landed two days before.
const NOW = new Date("2026-08-20T13:00:00.000Z");

describe("period windows", () => {
  it("aligns the week to Sunday and the month to the first", () => {
    // 2026-08-20 is a Thursday.
    const week = periodStart("week", NOW);
    const month = periodStart("month", NOW);
    expect(week).not.toBeNull();
    expect(new Date(week as number).getDay()).toBe(0);
    expect(new Date(month as number).getDate()).toBe(1);
  });

  it("has no lower bound for all time", () => {
    expect(periodStart("all", NOW)).toBeNull();
  });
});

describe("building trips", () => {
  it("includes only delivered loads assigned to the driver", () => {
    const trips = buildTrips(state.shipments, "driver-brenna", "all", NOW);
    expect(trips.length).toBeGreaterThan(0);
    for (const trip of trips) {
      expect(trip.shipment.status).toBe("delivered");
      expect(trip.shipment.assignedDriverId).toBe("driver-brenna");
    }
  });

  it("returns nothing for a driver with no delivered loads", () => {
    expect(buildTrips(state.shipments, "driver-kenji", "all", NOW)).toHaveLength(0);
  });

  it("earns the same share the settlement builder uses", () => {
    const [trip] = buildTrips(state.shipments, "driver-brenna", "all", NOW);
    const expected = Math.round(trip.shipment.charges.linehaulCents * DRIVER_LINEHAUL_SHARE) +
      trip.shipment.charges.accessorialsCents;
    expect(trip.earningsCents).toBe(expected);
  });

  it("orders most recent first", () => {
    const trips = buildTrips(state.shipments, "driver-brenna", "all", NOW);
    const stamps = trips.map((trip) => trip.deliveredAt);
    expect([...stamps].sort((left, right) => right - left)).toEqual(stamps);
  });

  it("excludes a delivery that falls before the window", () => {
    const ancient = buildTrips(
      state.shipments,
      "driver-brenna",
      "week",
      new Date("2027-01-14T00:00:00.000Z"),
    );
    expect(ancient).toHaveLength(0);
  });
});

describe("totals", () => {
  it("sums miles and earnings across the trips it was given", () => {
    const trips = buildTrips(state.shipments, "driver-brenna", "all", NOW);
    const totals = summarizeTrips(trips);
    expect(totals.loads).toBe(trips.length);
    expect(totals.miles).toBe(trips.reduce((sum, trip) => sum + trip.miles, 0));
    expect(totals.earningsCents).toBe(
      trips.reduce((sum, trip) => sum + trip.earningsCents, 0),
    );
  });

  it("reports no on-time rate when nothing was stamped", () => {
    expect(summarizeTrips([]).onTimeRate).toBeNull();
  });
});

describe("punctuality and duration", () => {
  const delivered = state.shipments.find(
    (shipment) => shipment.status === "delivered",
  ) as Shipment;

  it("measures a delivery completed inside its window as on time", () => {
    expect(wasOnTime(delivered)).toBe(true);
  });

  it("cannot judge a load whose final stop was never completed", () => {
    const open = state.shipments.find((shipment) => shipment.status === "tendered") as Shipment;
    expect(wasOnTime(open)).toBeNull();
  });

  it("measures elapsed time from first arrival to final completion", () => {
    const stops = [...delivered.stops].sort((left, right) => left.sequence - right.sequence);
    const expected = Math.round(
      (Date.parse(stops[stops.length - 1].completedAt as string) -
        Date.parse(stops[0].arrivedAt as string)) / 60_000,
    );
    expect(tripDurationMinutes(delivered)).toBe(expected);
  });
});

describe("formatting", () => {
  it("renders durations without a stray zero-minute suffix", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(155)).toBe("2h 35m");
  });

  it("drops cents on whole dollars and keeps them otherwise", () => {
    expect(formatCents(124_200)).toBe("$1,242");
    expect(formatCents(8_550)).toBe("$85.50");
  });

  it("groups trips into descending day buckets", () => {
    const trips = buildTrips(state.shipments, "driver-brenna", "all", NOW);
    const groups = groupTripsByDay(trips);
    expect(groups.length).toBeGreaterThan(0);
    const keys = groups.map((group) => group.dateKey);
    expect([...keys].sort().reverse()).toEqual(keys);
  });
});
