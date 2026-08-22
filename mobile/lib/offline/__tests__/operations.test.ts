import { describe, expect, it } from "@jest/globals";

import { toMutationOperation } from "../operations";
import type { OfflineMutation, OfflineMutationKind, OfflineMutationPayload } from "../types";

const SHIPMENT_ID = "550e8400-e29b-41d4-a716-446655440010";
const DOCUMENT_ID = "550e8400-e29b-41d4-a716-446655440011";
const STOP_ID = "550e8400-e29b-41d4-a716-446655440012";

function mutation(
  kind: OfflineMutationKind,
  payload: OfflineMutationPayload,
  shipmentId: string = SHIPMENT_ID,
): OfflineMutation {
  return {
    attempts: 0,
    deviceCreatedAt: "2026-08-21T12:00:00.000Z",
    entityId: "entity-1",
    entityVersion: 2,
    idempotencyKey: "idem-key-0000000001",
    kind,
    lastFailure: null,
    nextAttemptAt: null,
    ownerUserId: "user-1",
    payload,
    pendingFileUris: [],
    shipmentId,
  };
}

describe("toMutationOperation", () => {
  it("maps driver duty status and omits unassigned shipment ids", () => {
    expect(toMutationOperation(mutation("driver_status", { status: "driving" }))).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "driver.duty_status.update",
      payload: { status: "driving", shipmentId: SHIPMENT_ID },
    });
    expect(
      toMutationOperation(mutation("driver_status", { status: "off_duty" }, "unassigned-driver-1")),
    ).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "driver.duty_status.update",
      payload: { status: "off_duty" },
    });
  });

  it("maps driver locations with coordinates", () => {
    expect(
      toMutationOperation(mutation("location", { coordinates: { latitude: 44.1, longitude: -93.2 } })),
    ).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "driver.location.record",
      payload: { latitude: 44.1, longitude: -93.2, shipmentId: SHIPMENT_ID },
    });
  });

  it("maps shipment status transitions and skips local-only statuses", () => {
    expect(toMutationOperation(mutation("shipment_status", { status: "in_transit" }))).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "shipment.status.update",
      payload: { shipmentId: SHIPMENT_ID, status: "in_transit" },
    });
    expect(toMutationOperation(mutation("shipment_status", { status: "dispatched" }))).not.toBeNull();
    expect(toMutationOperation(mutation("shipment_status", { status: "loaded" }))).toBeNull();
    expect(toMutationOperation(mutation("shipment_status", { status: "cancelled" }))).toBeNull();
  });

  it("maps exception reports and drops non-uuid stop ids", () => {
    const input = {
      category: "cargo_damage" as const,
      description: "One pallet wrap is torn.",
      severity: "medium" as const,
      stopId: STOP_ID,
    };
    expect(toMutationOperation(mutation("exception", { input }))).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "shipment.exception.report",
      payload: {
        category: "cargo_damage",
        description: "One pallet wrap is torn.",
        severity: "medium",
        shipmentId: SHIPMENT_ID,
        stopId: STOP_ID,
      },
    });
    const operation = toMutationOperation(
      mutation("exception", { input: { ...input, stopId: "stop-28471-delivery" } }),
    );
    expect(operation?.payload).not.toHaveProperty("stopId");
  });

  it("maps photo and signature attachments to their uploaded documents", () => {
    const photo = mutation("photo", {
      fileName: "delivery.jpg",
      fileUri: "file://delivery.jpg",
      mimeType: "image/jpeg",
    });
    expect(toMutationOperation(photo, DOCUMENT_ID)).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "shipment.photo.attach",
      payload: { documentId: DOCUMENT_ID, shipmentId: SHIPMENT_ID },
    });
    expect(() => toMutationOperation(photo)).toThrow("requires an uploaded document");
    expect(
      toMutationOperation(mutation("signature", { signatureData: "file://signature.png" }), DOCUMENT_ID),
    ).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "shipment.signature.record",
      payload: { documentId: DOCUMENT_ID, shipmentId: SHIPMENT_ID },
    });
  });

  it("maps proof of delivery submissions", () => {
    const input = {
      notes: "Received",
      recipientName: "Receiver",
      signatureData: "file://signature.png",
      stopId: STOP_ID,
    };
    expect(toMutationOperation(mutation("pod", { input }))).toEqual({
      idempotencyKey: "idem-key-0000000001",
      occurredAt: "2026-08-21T12:00:00.000Z",
      operation: "shipment.pod.submit",
      payload: {
        notes: "Received",
        recipientName: "Receiver",
        shipmentId: SHIPMENT_ID,
        stopId: STOP_ID,
      },
    });
  });
});

describe("availability replay", () => {
  const base = {
    attempts: 0,
    deviceCreatedAt: "2026-08-20T13:00:00.000Z",
    entityVersion: 0,
    idempotencyKey: "key-availability",
    lastFailure: null,
    nextAttemptAt: null,
    ownerUserId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    pendingFileUris: [],
  };

  /**
   * The write a driver makes from the cab, where signal is least reliable.
   * Losing it would leave dispatch believing a driver is available when they
   * have said otherwise, so it has to survive the queue round trip intact.
   */
  it("maps a queued block onto its replay operation", () => {
    const operation = toMutationOperation({
      ...base,
      entityId: "availability-1",
      kind: "availability",
      payload: {
        block: {
          endsAt: "2026-09-02T18:00:00.000Z",
          kind: "unavailable",
          note: "Medical appointment",
          startsAt: "2026-09-02T06:00:00.000Z",
        },
      },
      shipmentId: "availability-driver-brenna",
    });

    expect(operation).toMatchObject({
      operation: "availability.block.set",
      payload: {
        endsAt: "2026-09-02T18:00:00.000Z",
        kind: "unavailable",
        note: "Medical appointment",
        startsAt: "2026-09-02T06:00:00.000Z",
      },
    });
  });

  it("omits the optional fields it was not given", () => {
    const operation = toMutationOperation({
      ...base,
      entityId: "availability-2",
      kind: "availability",
      payload: {
        block: {
          endsAt: "2026-09-02T18:00:00.000Z",
          kind: "time_off",
          startsAt: "2026-09-02T06:00:00.000Z",
        },
      },
      shipmentId: "availability-driver-brenna",
    });

    expect(operation?.payload).not.toHaveProperty("id");
    expect(operation?.payload).not.toHaveProperty("driverId");
    expect(operation?.payload).not.toHaveProperty("note");
  });

  it("maps a queued removal onto its own operation", () => {
    const operation = toMutationOperation({
      ...base,
      entityId: "availability-3",
      kind: "availability_removal",
      payload: { blockId: "availability-3" },
      shipmentId: "availability-driver-brenna",
    });

    expect(operation).toMatchObject({
      operation: "availability.block.remove",
      payload: { id: "availability-3" },
    });
  });
});
