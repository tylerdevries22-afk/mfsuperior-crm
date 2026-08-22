import { createDemoOperationsState } from "@/domain/fixtures";
import type { AvailabilityRule, Driver, Shipment } from "@/domain/types";

import {
  assignableDrivers,
  buildJobEntries,
  driversBlockedFor,
  entriesInLane,
  laneCounts,
  laneFor,
} from "../utils";

const state = createDemoOperationsState();
const NO_EXCEPTIONS = new Set<string>();

function shipmentWith(overrides: Partial<Shipment>): Shipment {
  return { ...state.shipments[0], ...overrides };
}

describe("dispatch lanes", () => {
  it("puts each status in exactly one lane", () => {
    expect(laneFor(shipmentWith({ status: "tendered" }))).toBe("tendered");
    expect(laneFor(shipmentWith({ status: "in_transit" }))).toBe("active");
    expect(laneFor(shipmentWith({ status: "delivered" }))).toBe("closed");
    expect(laneFor(shipmentWith({ status: "cancelled" }))).toBe("closed");
    expect(laneFor(shipmentWith({ status: "declined" }))).toBe("closed");
  });

  /** Accepted but nobody driving it is the lane dispatch actually works from. */
  it("separates an accepted load with a driver from one without", () => {
    expect(laneFor(shipmentWith({ assignedDriverId: undefined, status: "accepted" })))
      .toBe("unassigned");
    expect(laneFor(shipmentWith({ assignedDriverId: "driver-brenna", status: "accepted" })))
      .toBe("active");
  });

  it("counts every load into exactly one lane", () => {
    const entries = buildJobEntries(state.shipments, state.drivers, NO_EXCEPTIONS);
    const counts = laneCounts(entries);
    const total = counts.active + counts.closed + counts.tendered + counts.unassigned;
    expect(total).toBe(state.shipments.length);
  });

  it("floats a load with an open exception to the top of its lane", () => {
    const active = state.shipments.filter((shipment) => laneFor(shipment) === "active");
    const flagged = new Set([active[active.length - 1]?.id ?? ""]);
    const entries = buildJobEntries(state.shipments, state.drivers, flagged);
    const inLane = entriesInLane(entries, "active");
    expect(inLane[0]?.hasOpenException).toBe(true);
  });
});

describe("assignable drivers", () => {
  it("excludes a suspended driver outright", () => {
    const suspended: Driver = { ...state.drivers[0], id: "driver-suspended", status: "suspended" };
    const candidates = assignableDrivers([...state.drivers, suspended], new Set());
    expect(candidates.map((driver) => driver.id)).not.toContain("driver-suspended");
  });

  it("sinks a blocked driver below the rest", () => {
    const blocked = new Set([state.drivers[0].id]);
    const candidates = assignableDrivers(state.drivers, blocked);
    expect(candidates[candidates.length - 1].id).toBe(state.drivers[0].id);
  });
});

describe("blocked drivers", () => {
  const load = state.shipments.find((shipment) => shipment.status === "dispatched") as Shipment;
  const start = load.stops[0].appointment.startsAt;
  const end = load.stops[load.stops.length - 1].appointment.endsAt;

  it("flags a driver with a one-off block over the window", () => {
    const blocked = driversBlockedFor(
      state.drivers,
      [{
        createdAt: start,
        driverId: "driver-kenji",
        endsAt: end,
        id: "block-1",
        kind: "unavailable",
        startsAt: start,
        updatedAt: start,
      }],
      [],
      start,
      end,
    );
    expect(blocked.has("driver-kenji")).toBe(true);
  });

  /**
   * The gap this helper was extracted to close. The screen previously read
   * one-off blocks only, so a driver who is off every Sunday looked free on a
   * Sunday load — the calendar failing at the one job it has.
   */
  it("flags a driver whose standing weekly pattern covers the window", () => {
    const sunday = "2026-08-23T18:00:00.000Z";
    const sundayEnd = "2026-08-23T22:00:00.000Z";
    const rule: AvailabilityRule = {
      createdAt: "2026-01-01T12:00:00.000Z",
      driverId: "driver-kenji",
      effectiveFrom: "2026-01-01T12:00:00.000Z",
      endMinute: 1_440,
      id: "rule-sunday",
      kind: "unavailable",
      startMinute: 0,
      updatedAt: "2026-01-01T12:00:00.000Z",
      weekday: 0,
    };
    const blocked = driversBlockedFor(state.drivers, [], [rule], sunday, sundayEnd);
    expect(blocked.has("driver-kenji")).toBe(true);
  });

  it("does not flag a preferred window as blocked", () => {
    const blocked = driversBlockedFor(
      state.drivers,
      [{
        createdAt: start,
        driverId: "driver-kenji",
        endsAt: end,
        id: "block-1",
        kind: "preferred",
        startsAt: start,
        updatedAt: start,
      }],
      [],
      start,
      end,
    );
    expect(blocked.size).toBe(0);
  });

  it("flags nobody when the load has no schedule", () => {
    expect(driversBlockedFor(state.drivers, [], [], null, null).size).toBe(0);
  });
});
