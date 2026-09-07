import type {
  ExceptionReport,
  ExceptionReportInput,
  FreightRequestLocationInput,
  ProofOfDelivery,
  ProofOfDeliveryInput,
  Shipment,
  ShipmentStatus,
} from "../../domain/types";
import type { OfflineMutation } from "../../lib/offline";

export function createOptimisticException(
  mutation: OfflineMutation,
  userId: string,
  input: ExceptionReportInput,
): ExceptionReport {
  return {
    attachmentUris: input.attachmentUris ?? [],
    category: input.category,
    description: input.description,
    id: mutation.idempotencyKey,
    reportedAt: mutation.deviceCreatedAt,
    reportedByAccountId: userId,
    severity: input.severity,
    shipmentId: mutation.shipmentId,
    status: "open",
    stopId: input.stopId,
  };
}

export function createOptimisticProof(
  mutation: OfflineMutation,
  userId: string,
  shipmentId: string,
  input: ProofOfDeliveryInput,
): ProofOfDelivery {
  return {
    attachments: (input.attachments ?? []).map((attachment, index) => ({
      ...attachment,
      id: `${mutation.idempotencyKey}-attachment-${index}`,
    })),
    id: mutation.idempotencyKey,
    notes: input.notes ?? "",
    recipientName: input.recipientName,
    shipmentId,
    signatureData: input.signatureData,
    status: "submitted",
    stopId: input.stopId,
    submittedAt: mutation.deviceCreatedAt,
    submittedByAccountId: userId,
  };
}

export function toFreightLocation(location: FreightRequestLocationInput) {
  return {
    addressLine1: location.addressLine1,
    city: location.city,
    countryCode: "US",
    postalCode: location.postalCode,
    state: location.state,
    ...(location.name ? { name: location.name } : {}),
  };
}

/** The server only resumes an exception into a status it can transition to. */
export function resumableStatus(status: ShipmentStatus): "dispatched" | "in_transit" | "at_delivery" {
  if (status === "in_transit" || status === "loaded") return "in_transit";
  if (status === "at_delivery") return "at_delivery";
  return "dispatched";
}

export function shipmentVersion(shipment: Shipment | null): number {
  return shipment?.entityVersion ?? shipment?.events.length ?? 0;
}
