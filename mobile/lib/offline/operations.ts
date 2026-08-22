import type {
  AvailabilityBlockInput,
  ExceptionReportInput,
  GeoPoint,
  HosDutyStatus,
  ProofOfDeliveryInput,
  ShipmentStatus,
} from "../../domain/types";
import type { OfflineMutation } from "./types";

export type MutationOperationName =
  | "driver.duty_status.update"
  | "driver.location.record"
  | "shipment.exception.report"
  | "shipment.photo.attach"
  | "shipment.signature.record"
  | "shipment.status.update"
  | "shipment.pod.submit"
  | "availability.block.set"
  | "availability.block.remove";

export interface MutationOperation {
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly operation: MutationOperationName;
  readonly payload: Record<string, unknown>;
}

/** Shipment statuses the backend `shipment.status.update` contract accepts. */
const SYNCABLE_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  "dispatched",
  "at_pickup",
  "in_transit",
  "at_delivery",
  "delivered",
  "exception",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

/**
 * Translates a queued offline mutation into the `POST /v1/mutations` contract.
 * Returns `null` for mutations with no server-side representation (for example
 * the local-only `loaded` shipment status); the queue treats those as synced.
 * Photo and signature kinds require the document id produced by the flush-time
 * signed-upload flow.
 */
export function toMutationOperation(
  mutation: OfflineMutation,
  resolvedDocumentId?: string,
): MutationOperation | null {
  const base = {
    idempotencyKey: mutation.idempotencyKey,
    occurredAt: mutation.deviceCreatedAt,
  };
  switch (mutation.kind) {
    case "availability": {
      const payload = mutation.payload as { readonly block: AvailabilityBlockInput };
      return {
        ...base,
        operation: "availability.block.set",
        payload: {
          endsAt: payload.block.endsAt,
          kind: payload.block.kind,
          ...(payload.block.id ? { id: payload.block.id } : {}),
          ...(payload.block.driverId ? { driverId: payload.block.driverId } : {}),
          ...(payload.block.note ? { note: payload.block.note } : {}),
          startsAt: payload.block.startsAt,
        },
      };
    }
    case "availability_removal": {
      const payload = mutation.payload as { readonly blockId: string };
      return { ...base, operation: "availability.block.remove", payload: { id: payload.blockId } };
    }
    case "driver_status": {
      const payload = mutation.payload as { readonly status: HosDutyStatus };
      return {
        ...base,
        operation: "driver.duty_status.update",
        payload: {
          status: payload.status,
          ...(asUuid(mutation.shipmentId) ? { shipmentId: mutation.shipmentId } : {}),
        },
      };
    }
    case "location": {
      const payload = mutation.payload as { readonly coordinates: GeoPoint };
      return {
        ...base,
        operation: "driver.location.record",
        payload: {
          latitude: payload.coordinates.latitude,
          longitude: payload.coordinates.longitude,
          ...(asUuid(mutation.shipmentId) ? { shipmentId: mutation.shipmentId } : {}),
        },
      };
    }
    case "shipment_status": {
      const payload = mutation.payload as {
        readonly status: ShipmentStatus;
        readonly stopId?: string;
      };
      if (!SYNCABLE_SHIPMENT_STATUSES.has(payload.status)) {
        return null;
      }
      return {
        ...base,
        operation: "shipment.status.update",
        payload: { shipmentId: mutation.shipmentId, status: payload.status },
      };
    }
    case "exception": {
      const payload = mutation.payload as { readonly input: ExceptionReportInput };
      const stopId = asUuid(payload.input.stopId);
      return {
        ...base,
        operation: "shipment.exception.report",
        payload: {
          category: payload.input.category,
          description: payload.input.description,
          severity: payload.input.severity,
          shipmentId: mutation.shipmentId,
          ...(stopId ? { stopId } : {}),
        },
      };
    }
    case "photo": {
      return {
        ...base,
        operation: "shipment.photo.attach",
        payload: {
          documentId: requireDocumentId(mutation, resolvedDocumentId),
          shipmentId: mutation.shipmentId,
        },
      };
    }
    case "signature": {
      return {
        ...base,
        operation: "shipment.signature.record",
        payload: {
          documentId: requireDocumentId(mutation, resolvedDocumentId),
          shipmentId: mutation.shipmentId,
        },
      };
    }
    case "pod": {
      const payload = mutation.payload as { readonly input: ProofOfDeliveryInput };
      const stopId = asUuid(payload.input.stopId);
      return {
        ...base,
        operation: "shipment.pod.submit",
        payload: {
          recipientName: payload.input.recipientName,
          shipmentId: mutation.shipmentId,
          ...(payload.input.notes ? { notes: payload.input.notes } : {}),
          ...(stopId ? { stopId } : {}),
        },
      };
    }
  }
}

function requireDocumentId(
  mutation: OfflineMutation,
  resolvedDocumentId: string | undefined,
): string {
  if (!resolvedDocumentId) {
    throw new Error(
      `Offline mutation ${mutation.idempotencyKey} requires an uploaded document.`,
    );
  }
  return resolvedDocumentId;
}
