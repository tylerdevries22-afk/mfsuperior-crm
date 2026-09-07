import { OperationsDomainError } from "../../domain/errors";
import type { EntityId, Shipment, ShipmentEvent } from "../../domain/types";
import { getSessionContext, type DemoWriteContext, type StateUpdate } from "./context";
import { appendEdiTransaction, createEdiTransaction } from "./edi";
import { findShipment } from "./lookups";
import { assertCanOperateShipment, eventSourceForRole, replaceShipment } from "./shipmentSupport";

export function advanceIntermediateStop(
  { state, occurredAt, nextId }: DemoWriteContext,
  shipmentId: EntityId,
  stopId: EntityId,
): StateUpdate<Shipment> {
  const context = getSessionContext(state);
  const shipment = findShipment(state, shipmentId);
  assertCanOperateShipment(context, shipment);

  if (shipment.status !== "in_transit") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Intermediate stops can only be updated while a shipment is in transit.",
    );
  }

  const stop = shipment.stops.find((candidate) => candidate.id === stopId);
  if (!stop || stop.type !== "intermediate") {
    throw new OperationsDomainError("NOT_FOUND", "The intermediate stop could not be found.");
  }

  const nextRequiredStop = shipment.stops.find(
    (candidate) => candidate.type === "intermediate" && candidate.status !== "completed" && candidate.status !== "skipped",
  );
  if (nextRequiredStop?.id !== stop.id) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Route stops must be completed in order.",
      { requiredStopId: nextRequiredStop?.id ?? null },
    );
  }
  if (stop.status !== "pending" && stop.status !== "arrived") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "This route stop has already been completed.",
      { stopId },
    );
  }

  const arriving = stop.status === "pending";
  const updatedStop = arriving
    ? { ...stop, status: "arrived" as const, arrivedAt: occurredAt }
    : { ...stop, status: "completed" as const, completedAt: occurredAt };
  const event: ShipmentEvent = {
    id: nextId("event"),
    shipmentId,
    type: arriving ? "arrived_at_stop" : "departed_stop",
    eventCode: arriving ? "X6" : "X8",
    source: eventSourceForRole(context.effectiveRole),
    occurredAt,
    description: arriving
      ? `Arrived at ${stop.facilityName}`
      : `Completed ${stop.facilityName}`,
    stopId,
    coordinates: stop.coordinates,
    isSimulated: true,
  };
  const updatedShipment: Shipment = {
    ...shipment,
    stops: shipment.stops.map((candidate) => candidate.id === stopId ? updatedStop : candidate),
    events: [...shipment.events, event],
    updatedAt: occurredAt,
  };
  let nextState = replaceShipment(state, updatedShipment, occurredAt);
  nextState = appendEdiTransaction(
    nextState,
    createEdiTransaction(
      nextId("edi"),
      updatedShipment,
      "214",
      event.description,
      occurredAt,
    ),
    occurredAt,
  );
  return { state: nextState, result: updatedShipment };
}
