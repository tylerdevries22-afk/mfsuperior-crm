import { createDemoOperationsState } from "@/domain/fixtures";
import type { MaintenanceOrder, Vehicle } from "@/domain/types";

import {
  PM_INTERVAL_MILES,
  buildMaintenanceEntries,
  milesToNextService,
  severityTone,
  summarizeMaintenance,
} from "../utils";

const state = createDemoOperationsState();

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    createdAt: "2026-01-01T12:00:00.000Z",
    id: "vehicle-test",
    make: "Freightliner",
    model: "Cascadia",
    odometerMiles: 412_880,
    plateNumber: "CO-00000",
    plateState: "CO",
    status: "active",
    type: "tractor",
    unitNumber: "T-999",
    updatedAt: "2026-01-01T12:00:00.000Z",
    vin: "1FUJGLDR8CLBP0000",
    year: 2022,
    ...overrides,
  };
}

function pm(overrides: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    description: "",
    id: "maintenance-test",
    kind: "preventive",
    openedAt: "2026-01-01T12:00:00.000Z",
    severity: "low",
    status: "completed",
    summary: "PM-A",
    updatedAt: "2026-01-01T12:00:00.000Z",
    vehicleId: "vehicle-test",
    ...overrides,
  };
}

describe("preventive service interval", () => {
  /**
   * The defect this guards. Measuring from zero turned a missing record into a
   * precise-looking claim — a 412,880-mile unit reported being 387,880 miles
   * overdue, which is not true of any truck still on the road.
   */
  it("reports nothing rather than a false overdue distance with no PM on file", () => {
    expect(milesToNextService(vehicle(), [])).toBeNull();
  });

  it("ignores a preventive order that is not completed", () => {
    const scheduled = pm({ odometerMiles: 400_000, status: "scheduled" });
    expect(milesToNextService(vehicle(), [scheduled])).toBeNull();
  });

  it("ignores a completed PM with no odometer reading", () => {
    expect(milesToNextService(vehicle(), [pm({ odometerMiles: undefined })])).toBeNull();
  });

  it("ignores another unit's service history", () => {
    const otherUnit = pm({ odometerMiles: 400_000, vehicleId: "vehicle-other" });
    expect(milesToNextService(vehicle(), [otherUnit])).toBeNull();
  });

  it("measures from the most recent completed PM", () => {
    const orders = [
      pm({ id: "old", odometerMiles: 350_000 }),
      pm({ id: "recent", odometerMiles: 400_000 }),
    ];
    // 25,000 interval less the 12,880 driven since the 400,000-mile service.
    expect(milesToNextService(vehicle(), orders)).toBe(PM_INTERVAL_MILES - 12_880);
  });

  it("reports a genuine overdue distance once a PM exists to measure from", () => {
    const orders = [pm({ odometerMiles: 380_000 })];
    const remaining = milesToNextService(vehicle(), orders);
    expect(remaining).toBe(PM_INTERVAL_MILES - 32_880);
    expect(remaining).toBeLessThan(0);
  });
});

describe("work order shaping", () => {
  const entries = buildMaintenanceEntries(
    state.maintenanceOrders,
    state.vehicles,
    state.drivers,
  );

  it("resolves each order to its unit", () => {
    expect(entries).toHaveLength(state.maintenanceOrders.length);
    for (const entry of entries) {
      expect(entry.vehicle).not.toBeNull();
    }
  });

  it("puts open orders ahead of closed ones, most severe first", () => {
    const openFlags = entries.map((entry) => entry.isOpen);
    expect(openFlags).toEqual([...openFlags].sort((left, right) => Number(right) - Number(left)));
    const openSeverities = entries.filter((entry) => entry.isOpen).map((entry) => entry.order.severity);
    expect(openSeverities[0]).toBe("high");
  });

  it("counts only open orders in the totals", () => {
    const totals = summarizeMaintenance(entries);
    expect(totals.open).toBe(entries.filter((entry) => entry.isOpen).length);
    expect(totals.scheduled).toBe(
      entries.filter((entry) => entry.order.status === "scheduled").length,
    );
  });

  it("maps severity to a tone", () => {
    expect(severityTone("critical")).toBe("danger");
    expect(severityTone("high")).toBe("warning");
    expect(severityTone("low")).toBe("neutral");
  });
});
