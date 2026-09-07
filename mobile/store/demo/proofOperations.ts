import { OperationsDomainError } from "../../domain/errors";
import { transitionShipmentStatus } from "../../domain/transitions";
import type {
  DemoOperationsState,
  EntityId,
  ProofOfDelivery,
  ProofOfDeliveryInput,
} from "../../domain/types";
import { getSessionContext, type DemoWriteContext, type StateUpdate } from "./context";
import { appendEdiTransaction, createEdiTransaction } from "./edi";
import { findShipment } from "./lookups";
import {
  assertCanOperateShipment,
  currentCoordinates,
  eventSourceForRole,
  replaceShipment,
} from "./shipmentSupport";
import { requireTrimmedText } from "./validation";

export function submitProofOfDelivery(
  { state, occurredAt, nextId }: DemoWriteContext,
  shipmentId: EntityId,
  input: ProofOfDeliveryInput,
): StateUpdate<ProofOfDelivery> {
  const context = getSessionContext(state);
  const shipment = findShipment(state, shipmentId);
  assertCanOperateShipment(context, shipment);
  requireTrimmedText(input.recipientName, "Recipient name", 2, 120);
  requireTrimmedText(input.signatureData, "Signature", 3, 100_000);
  (input.attachments ?? []).forEach((attachment) => {
    requireTrimmedText(attachment.uri, "Attachment URI", 3, 10_000);
    requireTrimmedText(attachment.name, "Attachment name", 1, 240);
  });

  if (state.proofsOfDelivery.some((proof) => proof.shipmentId === shipmentId)) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Proof of delivery has already been submitted for this shipment.",
    );
  }

  const transitioned = transitionShipmentStatus(shipment, "delivered", {
    eventId: nextId("event"),
    occurredAt,
    source: eventSourceForRole(context.effectiveRole),
    description: `Shipment delivered to ${input.recipientName.trim()}`,
    stopId: input.stopId,
    coordinates: currentCoordinates(state, context),
  });
  const proof: ProofOfDelivery = {
    id: nextId("pod"),
    shipmentId,
    stopId: input.stopId,
    status: "submitted",
    recipientName: input.recipientName.trim(),
    signatureData: input.signatureData,
    notes: input.notes?.trim() ?? "",
    attachments: (input.attachments ?? []).map((attachment) => ({
      ...attachment,
      id: nextId("attachment"),
    })),
    submittedByAccountId: context.account.id,
    submittedAt: occurredAt,
  };
  let nextState: DemoOperationsState = {
    ...replaceShipment(state, transitioned, occurredAt),
    proofsOfDelivery: [...state.proofsOfDelivery, proof],
    updatedAt: occurredAt,
  };
  nextState = appendEdiTransaction(
    nextState,
    createEdiTransaction(
      nextId("edi"),
      transitioned,
      "214",
      "Shipment delivered with proof of delivery",
      occurredAt,
    ),
    occurredAt,
  );
  return { state: nextState, result: proof };
}
