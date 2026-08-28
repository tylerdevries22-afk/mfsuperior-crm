import { describe, expect, it, jest } from "@jest/globals";

import { OperationsDomainError } from "../../domain/errors";
import { DEMO_ACCOUNT_CREDENTIALS } from "../../domain/fixtures";
import { summarizePayout } from "../../domain/payouts";
import type { AppRole } from "../../domain/types";
import type { AuthSessionStorage } from "../../lib/auth/secureStore";
import { DemoOperationsRepository } from "../DemoOperationsRepository";
import { MemoryPersistenceAdapter } from "../persistence";
import { PayoutMethodStore } from "../payoutMethodStore";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const CLOCK = "2026-08-20T13:00:00.000Z";

/** Keeps payout handles out of a real keychain during tests. */
class MemoryStorage implements AuthSessionStorage {
  private readonly entries = new Map<string, string>();
  async getItem(key: string) { return this.entries.get(key) ?? null; }
  async removeItem(key: string) { this.entries.delete(key); }
  async setItem(key: string, value: string) { this.entries.set(key, value); }
}

async function signedInAs(role: AppRole) {
  const repository = new DemoOperationsRepository({
    clock: () => CLOCK,
    payoutMethods: new PayoutMethodStore({ clock: () => CLOCK, storage: new MemoryStorage() }),
    persistence: new MemoryPersistenceAdapter(),
  });
  await repository.hydrate();
  const credentials = DEMO_ACCOUNT_CREDENTIALS[role];
  await repository.signIn(credentials.email, credentials.pin);
  return repository;
}

describe("availability authorization", () => {
  it("lets a driver write their own calendar", async () => {
    const repository = await signedInAs("driver");
    const block = await repository.setAvailabilityBlock({
      endsAt: "2026-09-02T18:00:00.000Z",
      kind: "unavailable",
      startsAt: "2026-09-02T06:00:00.000Z",
    });
    expect(block.driverId).toBe("driver-brenna");
    expect(repository.getState().availabilityBlocks).toContainEqual(block);
  });

  /** The boundary that matters: one driver may not edit another's calendar. */
  it("refuses a driver naming somebody else", async () => {
    const repository = await signedInAs("driver");
    await expect(repository.setAvailabilityBlock({
      driverId: "driver-kenji",
      endsAt: "2026-09-02T18:00:00.000Z",
      kind: "unavailable",
      startsAt: "2026-09-02T06:00:00.000Z",
    })).rejects.toThrow(OperationsDomainError);
  });

  it("lets an admin write any driver's calendar", async () => {
    const repository = await signedInAs("admin");
    const block = await repository.setAvailabilityBlock({
      driverId: "driver-kenji",
      endsAt: "2026-09-02T18:00:00.000Z",
      kind: "time_off",
      startsAt: "2026-09-02T06:00:00.000Z",
    });
    expect(block.driverId).toBe("driver-kenji");
  });

  it("refuses a customer entirely", async () => {
    const repository = await signedInAs("customer");
    await expect(repository.setAvailabilityBlock({
      endsAt: "2026-09-02T18:00:00.000Z",
      kind: "unavailable",
      startsAt: "2026-09-02T06:00:00.000Z",
    })).rejects.toThrow(OperationsDomainError);
  });

  it("refuses a block that ends before it starts", async () => {
    const repository = await signedInAs("driver");
    await expect(repository.setAvailabilityBlock({
      endsAt: "2026-09-02T06:00:00.000Z",
      kind: "unavailable",
      startsAt: "2026-09-02T18:00:00.000Z",
    })).rejects.toThrow(/end after it starts/);
  });

  it("removes a rule's expanded blocks along with the rule", async () => {
    const repository = await signedInAs("driver");
    const rule = await repository.setAvailabilityRule({
      effectiveFrom: "2026-08-01T06:00:00.000Z",
      endMinute: 1_440,
      kind: "unavailable",
      startMinute: 0,
      weekday: 3,
    });
    await repository.removeAvailabilityRule(rule.id);
    const state = repository.getState();
    expect(state.availabilityRules.find((entry) => entry.id === rule.id)).toBeUndefined();
    expect(state.availabilityBlocks.some((block) => block.ruleId === rule.id)).toBe(false);
  });

  it("refuses a weekly pattern that does not fit inside a day", async () => {
    const repository = await signedInAs("driver");
    await expect(repository.setAvailabilityRule({
      effectiveFrom: "2026-08-01T06:00:00.000Z",
      endMinute: 2_000,
      kind: "unavailable",
      startMinute: 0,
      weekday: 3,
    })).rejects.toThrow(/inside one day/);
  });
});

describe("driver shift coverage", () => {
  it("lets an admin create a shift and rejects hard conflicts", async () => {
    const repository = await signedInAs("admin");
    const created = await repository.setDriverShift({
      driverId: "driver-ray",
      endsAt: "2026-09-02T16:00:00.000Z",
      startsAt: "2026-09-02T08:00:00.000Z",
    });
    expect(created.status).toBe("scheduled");
    expect(repository.getState().scheduleSyncStatuses.find((sync) => sync.entityId === created.id)?.status).toBe("pending");
    await expect(repository.setDriverShift({
      driverId: "driver-ray",
      endsAt: "2026-09-02T12:00:00.000Z",
      startsAt: "2026-09-02T10:00:00.000Z",
    })).rejects.toThrow(/another shift/);
  });

  it("requires the target driver to approve before transferring one shift", async () => {
    const repository = await signedInAs("admin");
    const request = repository.getState().shiftCoverageRequests[0];
    expect(request?.status).toBe("pending");
    const originalShipmentAssignments = repository.getState().shipments.map((shipment) => ({
      driverId: shipment.assignedDriverId,
      id: shipment.id,
    }));
    const declined = await repository.respondToShiftCoverage(request?.id ?? "", "declined");
    expect(declined.status).toBe("declined");
    expect(repository.getState().driverShifts.find((shift) => shift.id === request?.shiftId)?.driverId).toBe(request?.fromDriverId);

    const secondRequest = await repository.requestShiftCoverage({
      shiftId: request?.shiftId ?? "",
      targetDriverId: "driver-brenna",
    });
    const accepted = await repository.respondToShiftCoverage(secondRequest.id, "accepted");
    expect(accepted.status).toBe("accepted");
    expect(repository.getState().driverShifts.find((shift) => shift.id === secondRequest.shiftId)?.driverId).toBe("driver-brenna");
    expect(repository.getState().shipments.map((shipment) => ({ driverId: shipment.assignedDriverId, id: shipment.id }))).toEqual(originalShipmentAssignments);
  });

  it("allows a driver to request coverage only for a future shift", async () => {
    const repository = await signedInAs("driver");
    const ownShift = repository.getState().driverShifts.find((shift) => shift.driverId === "driver-brenna");
    await expect(repository.requestShiftCoverage({
      shiftId: ownShift?.id ?? "",
      targetDriverId: "driver-samuel",
    })).rejects.toThrow(/future shifts/);
  });
});

describe("payout methods", () => {
  it("keeps handles out of the operations state entirely", async () => {
    const repository = await signedInAs("driver");
    await repository.savePayoutMethod({ handle: "@brenna-lewis", rail: "venmo" });
    expect(JSON.stringify(repository.getState())).not.toContain("brenna-lewis");
  });

  it("makes the first saved method the default", async () => {
    const repository = await signedInAs("driver");
    const method = await repository.savePayoutMethod({ handle: "@brenna-lewis", rail: "venmo" });
    expect(method.isDefault).toBe(true);
  });

  it("moves the default rather than holding two", async () => {
    const repository = await signedInAs("driver");
    await repository.savePayoutMethod({ handle: "@brenna-lewis", rail: "venmo" });
    const cashApp = await repository.savePayoutMethod({
      handle: "$brennalewis",
      isDefault: true,
      rail: "cash_app",
    });
    const methods = await repository.listPayoutMethods();
    expect(methods.filter((entry) => entry.isDefault)).toHaveLength(1);
    expect(methods.find((entry) => entry.isDefault)?.id).toBe(cashApp.id);
  });

  it("promotes another method when the default is removed", async () => {
    const repository = await signedInAs("driver");
    const venmo = await repository.savePayoutMethod({ handle: "@brenna-lewis", rail: "venmo" });
    await repository.savePayoutMethod({ handle: "$brennalewis", rail: "cash_app" });
    const remaining = await repository.removePayoutMethod(venmo.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isDefault).toBe(true);
  });

  it("replaces rather than duplicates a handle on the same rail", async () => {
    const repository = await signedInAs("driver");
    await repository.savePayoutMethod({ handle: "@brenna-lewis", rail: "venmo" });
    await repository.savePayoutMethod({ handle: "@brenna-l", rail: "venmo" });
    const methods = await repository.listPayoutMethods();
    expect(methods.filter((entry) => entry.rail === "venmo")).toHaveLength(1);
    expect(methods[0].handle).toBe("@brenna-l");
  });

  /** An admin must have no read path to a driver's handle. */
  it("refuses an admin reading or writing payout methods", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.listPayoutMethods()).rejects.toThrow(OperationsDomainError);
    await expect(repository.savePayoutMethod({ handle: "@someone", rail: "venmo" }))
      .rejects.toThrow(OperationsDomainError);
  });
});

describe("fleet and shop authorization", () => {
  it("lets an admin add a thumbnail and transfer a unit with notes", async () => {
    const repository = await signedInAs("admin");
    const thumbnail = await repository.updateVehicleThumbnail("vehicle-t101", {
      contentType: "image/jpeg",
      fileName: "unit-t101.jpg",
      uri: "file:///demo/unit-t101.jpg",
    });
    expect(thumbnail.thumbnailUrl).toBe("file:///demo/unit-t101.jpg");

    const transferred = await repository.transferVehicle(
      "vehicle-t101",
      "driver-kenji",
      "Covering the afternoon route.",
    );
    expect(transferred.assignedDriverId).toBe("driver-kenji");
  });

  it("refuses a driver managing the fleet", async () => {
    const repository = await signedInAs("driver");
    await expect(repository.assignVehicle("vehicle-t101", "driver-brenna"))
      .rejects.toThrow(OperationsDomainError);
    await expect(repository.transferVehicle("vehicle-t101", "driver-kenji", ""))
      .rejects.toThrow(OperationsDomainError);
    await expect(repository.updateVehicleThumbnail("vehicle-t101", {
      contentType: "image/jpeg",
      fileName: "unit-t101.jpg",
      uri: "file:///demo/unit-t101.jpg",
    })).rejects.toThrow(OperationsDomainError);
    await expect(repository.createMaintenanceOrder({
      description: "d",
      kind: "repair",
      severity: "low",
      summary: "s",
      vehicleId: "vehicle-t101",
    })).rejects.toThrow(OperationsDomainError);
  });

  it("refuses assigning a unit that is in the shop", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.assignVehicle("vehicle-t102", "driver-kenji"))
      .rejects.toThrow(/in the shop/);
  });

  it("refuses a duplicate unit number", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.upsertVehicle({
      make: "Volvo",
      model: "VNL",
      odometerMiles: 100,
      plateNumber: "CO-00001",
      plateState: "CO",
      status: "active",
      type: "tractor",
      unitNumber: "t-101",
      vin: "1AAAAAAAAAAAAAAAA",
      year: 2024,
    })).rejects.toThrow(/already in the fleet/);
  });

  /**
   * A critical order grounds the unit and releases its driver, so the fleet
   * board and the dispatch board cannot disagree about whether it can run.
   */
  it("takes a unit out of service on a critical order", async () => {
    const repository = await signedInAs("admin");
    await repository.createMaintenanceOrder({
      description: "Brake chamber failure",
      kind: "repair",
      severity: "critical",
      summary: "Brakes",
      vehicleId: "vehicle-t101",
    });
    const vehicle = repository.getState().vehicles.find((entry) => entry.id === "vehicle-t101");
    expect(vehicle?.status).toBe("out_of_service");
    expect(vehicle?.assignedDriverId).toBeUndefined();
  });

  it("returns a unit to service once its last open order closes", async () => {
    const repository = await signedInAs("admin");
    const order = await repository.createMaintenanceOrder({
      description: "Brake chamber failure",
      kind: "repair",
      severity: "critical",
      summary: "Brakes",
      vehicleId: "vehicle-tr221",
    });
    await repository.updateMaintenanceOrder(order.id, { status: "completed" });
    const vehicle = repository.getState().vehicles.find((entry) => entry.id === "vehicle-tr221");
    expect(vehicle?.status).toBe("active");
  });

  it("refuses changing a closed work order", async () => {
    const repository = await signedInAs("admin");
    const order = await repository.createMaintenanceOrder({
      description: "d",
      kind: "repair",
      severity: "low",
      summary: "s",
      vehicleId: "vehicle-tr221",
    });
    await repository.updateMaintenanceOrder(order.id, { status: "completed" });
    await expect(repository.updateMaintenanceOrder(order.id, { status: "open" }))
      .rejects.toThrow(/closed work order/);
  });

  it("refuses a document that expires before it was issued", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.upsertComplianceDocument({
      expiresOn: "2025-01-01T12:00:00.000Z",
      identifier: "X",
      issuedOn: "2026-01-01T12:00:00.000Z",
      issuingState: "CO",
      kind: "registration",
      subjectId: "vehicle-t101",
      subjectType: "vehicle",
    })).rejects.toThrow(/expire after it was issued/);
  });
});

describe("settlements", () => {
  it("refuses a driver issuing their own settlement", async () => {
    const repository = await signedInAs("driver");
    await expect(repository.issuePayout(
      "driver-brenna",
      "2026-08-16T06:00:00.000Z",
      "2026-08-23T06:00:00.000Z",
    )).rejects.toThrow(OperationsDomainError);
  });

  /** Two settlements over one delivery would pay for it twice. */
  it("refuses a period overlapping an existing settlement", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.issuePayout(
      "driver-brenna",
      "2026-08-09T06:00:00.000Z",
      "2026-08-16T06:00:00.000Z",
    )).rejects.toThrow(/overlaps a settlement/);
  });

  it("refuses a period with nothing delivered in it", async () => {
    const repository = await signedInAs("admin");
    await expect(repository.issuePayout(
      "driver-kenji",
      "2026-07-01T06:00:00.000Z",
      "2026-07-08T06:00:00.000Z",
    )).rejects.toThrow(/no delivered loads/);
  });

  it("builds line items that sum to net", async () => {
    const repository = await signedInAs("admin");
    const payout = await repository.issuePayout(
      "driver-brenna",
      "2026-08-16T06:00:00.000Z",
      "2026-08-23T06:00:00.000Z",
    );
    const totals = summarizePayout(payout.lineItems);
    expect(totals.netCents).toBe(payout.netCents);
    expect(totals.grossCents).toBe(payout.grossCents);
    expect(payout.status).toBe("pending");
  });

  it("records the rail but never a handle when marking paid", async () => {
    const repository = await signedInAs("admin");
    const payout = await repository.issuePayout(
      "driver-brenna",
      "2026-08-16T06:00:00.000Z",
      "2026-08-23T06:00:00.000Z",
    );
    const paid = await repository.markPayoutPaid(payout.id, "venmo");
    expect(paid.status).toBe("paid");
    expect(paid.rail).toBe("venmo");
    expect(paid.paidAt).toBe(CLOCK);
  });

  it("refuses paying a settlement twice", async () => {
    const repository = await signedInAs("admin");
    const payout = await repository.issuePayout(
      "driver-brenna",
      "2026-08-16T06:00:00.000Z",
      "2026-08-23T06:00:00.000Z",
    );
    await repository.markPayoutPaid(payout.id, "venmo");
    await expect(repository.markPayoutPaid(payout.id, "zelle"))
      .rejects.toThrow(/already recorded as paid/);
  });
});
