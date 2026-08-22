import { describe, expect, it, jest } from "@jest/globals";

import { OperationsDomainError, toOperationsFailure } from "../../domain/errors";
import { createDemoOperationsState } from "../../domain/fixtures";
import {
  advanceHosClock,
  transitionHosStatus,
  transitionShipmentStatus,
} from "../../domain/transitions";
import type { HosClock, Shipment } from "../../domain/types";
import { DemoOperationsRepository } from "../DemoOperationsRepository";
import { MemoryPersistenceAdapter } from "../persistence";
import {
  deserializeDemoOperationsState,
  isDemoOperationsState,
  migrateDemoOperationsState,
  serializeDemoOperationsState,
} from "../stateSchema";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe("unified demo operations domain", () => {
  it("validates, serializes, migrates, and recovers versioned demo state", async () => {
    const state = createDemoOperationsState();
    expect(isDemoOperationsState(state)).toBe(true);
    expect(deserializeDemoOperationsState(serializeDemoOperationsState(state))).toEqual(state);

    const legacyState = { ...state, version: undefined };
    expect(migrateDemoOperationsState({ version: 0, state: legacyState })).toEqual(state);
    expect(() => deserializeDemoOperationsState("not-json")).toThrow(OperationsDomainError);

    const repository = new DemoOperationsRepository({
      persistence: new MemoryPersistenceAdapter("not-json"),
      clock: () => "2026-08-20T13:00:00.000Z",
    });
    const hydration = await repository.hydrate();
    expect(hydration.recoveryFailure?.code).toBe("CORRUPT_PERSISTED_STATE");
    expect(hydration.state).toEqual(state);
    expect(toOperationsFailure(new Error("private"))).toEqual({
      code: "VALIDATION_FAILED",
      message: "The requested operation could not be completed.",
    });
  });

  it("enforces shipment order and updates pickup and delivery stops", () => {
    const initial = requiredShipment("shipment-28471");
    const atPickup = transitionShipmentStatus(initial, "at_pickup", shipmentContext("1"));
    expect(atPickup.stops[0]?.status).toBe("arrived");

    const loaded = transitionShipmentStatus(atPickup, "loaded", shipmentContext("2"));
    const inTransit = transitionShipmentStatus(loaded, "in_transit", shipmentContext("3"));
    expect(() => transitionShipmentStatus(inTransit, "at_delivery", shipmentContext("4"))).toThrow(
      "All earlier route stops must be completed",
    );

    const withIntermediateComplete: Shipment = {
      ...inTransit,
      stops: inTransit.stops.map((stop) => stop.type === "intermediate"
        ? { ...stop, status: "completed", completedAt: "2026-08-20T18:45:00.000Z" }
        : stop),
    };
    const atDelivery = transitionShipmentStatus(
      withIntermediateComplete,
      "at_delivery",
      shipmentContext("5"),
    );
    const delivered = transitionShipmentStatus(atDelivery, "delivered", shipmentContext("6"));
    expect(delivered.stops.at(-1)?.status).toBe("completed");
    expect(() => transitionShipmentStatus(delivered, "in_transit", shipmentContext("7"))).toThrow(
      "cannot move",
    );
  });

  it("accrues HOS counters and blocks driving without eligibility", () => {
    const baseClock = requiredClock();
    const driving = transitionHosStatus(baseClock, "driving", {
      entryId: "hos-test-1",
      occurredAt: "2026-08-20T13:00:00.000Z",
      locationDescription: "Minneapolis, MN",
      hasActiveShipment: true,
    });
    expect(driving.status).toBe("driving");
    expect(driving.shiftMinutesUsed).toBe(baseClock.shiftMinutesUsed + 15);
    expect(() => transitionHosStatus(driving, "driving", {
      entryId: "hos-test-2",
      occurredAt: "2026-08-20T13:01:00.000Z",
      locationDescription: "Minneapolis, MN",
      hasActiveShipment: true,
    })).toThrow("already driving");

    const breakRequiredClock: HosClock = {
      ...baseClock,
      minutesSinceQualifyingBreak: 480,
    };
    expect(() => transitionHosStatus(breakRequiredClock, "driving", {
      entryId: "hos-test-3",
      occurredAt: baseClock.statusStartedAt,
      locationDescription: "Minneapolis, MN",
      hasActiveShipment: true,
    })).toThrow("30-minute break");

    const resetClock = advanceHosClock(
      { ...baseClock, status: "off_duty" },
      "2026-08-20T22:45:00.000Z",
      "hos-test-4",
      "Minneapolis, MN",
    );
    expect(resetClock.drivingMinutesUsed).toBe(0);
    expect(resetClock.shiftMinutesUsed).toBe(0);
  });

  it("persists credential sessions, customer requests, and messages", async () => {
    const persistence = new MemoryPersistenceAdapter();
    const repository = createRepository(persistence);
    await repository.hydrate();
    await repository.signIn(" CUSTOMER@DEMO.MFSUPERIOR.COM ", "1111");
    const request = await repository.createCustomerRequest({
      type: "pickup",
      subject: "Schedule an additional pickup",
      details: "Please schedule a dry-van pickup for Friday morning.",
    });
    const message = await repository.sendMessage({
      threadId: "thread-support",
      threadKind: "support",
      recipientAccountIds: ["account-admin"],
      body: "Can dispatch confirm the new pickup request?",
    });
    await expect(repository.switchDemoRole("driver")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await repository.markMessageRead(message.id);

    const reloaded = createRepository(persistence);
    await reloaded.hydrate();
    expect(reloaded.getState().session.accountId).toBe("account-customer");
    expect(reloaded.getState().requests.some((candidate) => candidate.id === request.id)).toBe(true);
    expect(reloaded.getState().messages.some((candidate) => candidate.id === message.id)).toBe(true);
    await reloaded.signOut();
    await reloaded.resetDemo();
    expect(reloaded.getState().session.accountId).toBeNull();
  });

  it("runs the freight tender, driver, exception, POD, GPS, and EDI flows", async () => {
    const repository = createRepository(new MemoryPersistenceAdapter());
    await repository.hydrate();
    await repository.signIn("admin@demo.mfsuperior.com", "3333");
    await repository.respondToTender("shipment-28492", "accepted");
    // A driver already committed to another reserved load cannot be assigned.
    await expect(
      repository.assignShipment("shipment-28492", "driver-brenna"),
    ).rejects.toThrow("already assigned");
    await repository.assignShipment("shipment-28492", "driver-samuel");
    await repository.transitionShipment("shipment-28492", "dispatched");
    await repository.switchDemoRole("driver");
    await repository.transitionDutyStatus("driving");
    await repository.recordDriverLocation({ latitude: 44.95, longitude: -92.99 });
    await repository.switchDemoRole("admin");
    await repository.transitionShipment("shipment-28492", "at_pickup", "stop-28492-pickup");
    await repository.transitionShipment("shipment-28492", "loaded", "stop-28492-pickup");
    await repository.transitionShipment("shipment-28492", "in_transit");
    await repository.transitionShipment("shipment-28492", "at_delivery", "stop-28492-delivery");
    await expect(repository.transitionShipment("shipment-28492", "delivered")).rejects.toThrow(
      "Proof of delivery",
    );
    await repository.submitProofOfDelivery("shipment-28492", {
      stopId: "stop-28492-delivery",
      recipientName: "Alex M.",
      signatureData: "demo-signature://alex-m",
      notes: "Temperature verified and 22 pallets received.",
      attachments: [{ kind: "photo", uri: "demo-photo://28492", name: "Freight" }],
    });

    const exception = await repository.reportException("shipment-28471", {
      category: "delay",
      severity: "medium",
      description: "Carrier gate queue is delaying the scheduled check-in.",
    });
    await repository.switchDemoRole("admin");
    await repository.resolveException(exception.id, "Gate cleared and driver released.", "dispatched");

    const finalState = repository.getState();
    expect(finalState.shipments.find((shipment) => shipment.id === "shipment-28492")?.status).toBe(
      "delivered",
    );
    expect(finalState.proofsOfDelivery.some((proof) => proof.shipmentId === "shipment-28492")).toBe(true);
    expect(repository.getShipmentEdiTransactions("shipment-28492").map((edi) => edi.transactionType)).toEqual(
      expect.arrayContaining(["204", "990", "214"]),
    );
    expect(finalState.exceptions.find((candidate) => candidate.id === exception.id)?.status).toBe(
      "resolved",
    );
  });
});

function createRepository(persistence: MemoryPersistenceAdapter): DemoOperationsRepository {
  return new DemoOperationsRepository({
    persistence,
    clock: () => "2026-08-20T13:00:00.000Z",
  });
}

function requiredShipment(shipmentId: string): Shipment {
  const shipment = createDemoOperationsState().shipments.find((candidate) => candidate.id === shipmentId);
  if (!shipment) {
    throw new Error(`Missing fixture shipment ${shipmentId}.`);
  }
  return shipment;
}

function requiredClock(): HosClock {
  const clock = createDemoOperationsState().hosClocks[0];
  if (!clock) {
    throw new Error("Missing fixture HOS clock.");
  }
  return clock;
}

function shipmentContext(sequence: string) {
  return {
    eventId: `event-test-${sequence}`,
    occurredAt: `2026-08-20T${13 + Number(sequence)}:00:00.000Z`,
    source: "driver" as const,
  };
}
