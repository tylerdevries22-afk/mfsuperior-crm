import { createDemoOperationsState } from "@/domain/fixtures";
import type { Vehicle } from "@/domain/types";

import {
  buildFleetEntries,
  describeVehicle,
  formatOdometer,
  summarizeFleet,
  vehicleStatusTone,
} from "../utils";

const state = createDemoOperationsState();
const NOW = new Date("2026-08-20T13:00:00.000Z");

function entriesNow() {
  return buildFleetEntries(
    state.vehicles,
    state.drivers,
    state.maintenanceOrders,
    state.complianceDocuments,
    NOW,
  );
}

describe("fleet roster", () => {
  it("resolves an assigned driver and leaves a spare unassigned", () => {
    const entries = entriesNow();
    expect(entries).toHaveLength(state.vehicles.length);
    const assigned = entries.find((entry) => entry.vehicle.unitNumber === "T-101");
    const spare = entries.find((entry) => entry.vehicle.unitNumber === "TR-221");
    expect(assigned?.driver?.id).toBe("driver-brenna");
    expect(spare?.driver).toBeNull();
  });

  /** The board is a to-do list: anything needing a human sorts to the top. */
  it("floats units needing attention above the rest", () => {
    const flags = entriesNow().map((entry) => entry.needsAttention);
    expect(flags).toEqual([...flags].sort((left, right) => Number(right) - Number(left)));
  });

  it("counts an open work order as needing attention", () => {
    const inShop = entriesNow().find((entry) => entry.vehicle.unitNumber === "T-102");
    expect(inShop?.openOrders.length).toBeGreaterThan(0);
    expect(inShop?.needsAttention).toBe(true);
  });

  it("ignores completed and cancelled orders when counting open work", () => {
    const completed = entriesNow().find((entry) => entry.vehicle.unitNumber === "TR-220");
    expect(completed?.openOrders).toHaveLength(0);
  });

  it("surfaces only documents that are expired or expiring within thirty days", () => {
    const withExpiry = entriesNow().find((entry) => entry.vehicle.unitNumber === "T-101");
    // The seeded registration expires twelve days after the fixture clock.
    expect(withExpiry?.expiringDocuments.length).toBeGreaterThan(0);
    const far = entriesNow().find((entry) => entry.vehicle.unitNumber === "T-102");
    expect(far?.expiringDocuments).toHaveLength(0);
  });

  it("does not confuse another unit's paperwork for its own", () => {
    for (const entry of entriesNow()) {
      for (const document of entry.expiringDocuments) {
        expect(document.subjectId).toBe(entry.vehicle.id);
        expect(document.subjectType).toBe("vehicle");
      }
    }
  });
});

describe("fleet totals", () => {
  it("counts active, down, and unassigned consistently", () => {
    const entries = entriesNow();
    const totals = summarizeFleet(entries);
    expect(totals.total).toBe(entries.length);
    expect(totals.active).toBe(
      entries.filter((entry) => entry.vehicle.status === "active").length,
    );
    expect(totals.down).toBe(
      entries.filter((entry) => entry.vehicle.status === "in_shop" ||
        entry.vehicle.status === "out_of_service").length,
    );
  });

  /** A retired unit has no driver by design; that is not a gap in the roster. */
  it("does not count a retired unit as unassigned", () => {
    const retired: Vehicle = {
      ...state.vehicles[0],
      assignedDriverId: undefined,
      id: "vehicle-retired",
      status: "retired",
      unitNumber: "T-999",
    };
    const before = summarizeFleet(buildFleetEntries([], [], [], [], NOW)).unassigned;
    const after = summarizeFleet(
      buildFleetEntries([retired], state.drivers, [], [], NOW),
    ).unassigned;
    expect(after).toBe(before);
  });

  it("counts an active unit with no driver as unassigned", () => {
    const spare: Vehicle = {
      ...state.vehicles[0],
      assignedDriverId: undefined,
      id: "vehicle-spare",
      status: "active",
      unitNumber: "T-998",
    };
    expect(summarizeFleet(buildFleetEntries([spare], state.drivers, [], [], NOW)).unassigned)
      .toBe(1);
  });
});

describe("presentation", () => {
  it("maps each status to a tone", () => {
    expect(vehicleStatusTone("active")).toBe("success");
    expect(vehicleStatusTone("in_shop")).toBe("warning");
    expect(vehicleStatusTone("out_of_service")).toBe("danger");
    expect(vehicleStatusTone("retired")).toBe("neutral");
  });

  it("describes a unit and its odometer readably", () => {
    const vehicle = state.vehicles[0];
    expect(describeVehicle(vehicle)).toBe(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    expect(formatOdometer(412880)).toBe("412,880 mi");
  });

  it("handles a unit with no orders or documents at all", () => {
    const bare = buildFleetEntries([state.vehicles[0]], [], [], [], NOW)[0];
    expect(bare.driver).toBeNull();
    expect(bare.openOrders).toEqual([]);
    expect(bare.expiringDocuments).toEqual([]);
  });
});
