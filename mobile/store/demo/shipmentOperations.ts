import { OperationsDomainError } from "../../domain/errors";
import { transitionShipmentStatus } from "../../domain/transitions";
import type { DemoOperationsState, EntityId, Shipment, ShipmentStatus } from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { appendEdiTransaction, createEdiTransaction } from "./edi";
import { findShipment } from "./lookups";
import {
  assertCanOperateShipment,
  assertDriverAssignable,
  currentCoordinates,
  eventSourceForRole,
  isOperationalStatus,
  replaceShipment,
} from "./shipmentSupport";

export function respondToTender(
  { state, occurredAt, nextId }: DemoWriteContext,
  shipmentId: EntityId,
  response: "accepted" | "declined",
): StateUpdate<Shipment> {
  const context = getSessionContext(state);
  requireRole(context, "admin", "Only an admin can respond to a load tender.");
  const shipment = findShipment(state, shipmentId);
  const transitioned = transitionShipmentStatus(shipment, response, {
    eventId: nextId("event"),
    occurredAt,
    source: "admin",
  });
  let nextState = replaceShipment(state, transitioned, occurredAt);
  nextState = appendEdiTransaction(
    nextState,
    createEdiTransaction(
      nextId("edi"),
      transitioned,
      "990",
      response === "accepted" ? "Load tender acceptance" : "Load tender decline",
      occurredAt,
    ),
    occurredAt,
  );
  return { state: nextState, result: transitioned };
}

export function assignShipment(
  { state, occurredAt }: DemoWriteContext,
  shipmentId: EntityId,
  driverId: EntityId,
  offerPriceCents?: number,
): StateUpdate<Shipment> {
  const context = getSessionContext(state);
  requireRole(context, "admin", "Only an admin can assign a shipment.");
  const shipment = findShipment(state, shipmentId);
  if (shipment.status !== "accepted" && shipment.status !== "dispatched") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "A shipment must be accepted before a driver can be assigned.",
    );
  }
  assertDriverAssignable(state, shipment, driverId);

  const assignedShipment: Shipment = {
    ...shipment,
    assignedDriverId: driverId,
    charges: offerPriceCents === undefined
      ? shipment.charges
      : { ...shipment.charges, linehaulCents: offerPriceCents },
    updatedAt: occurredAt,
  };
  const nextState: DemoOperationsState = replaceShipment(state, assignedShipment, occurredAt);
  return { state: nextState, result: assignedShipment };
}

export function transitionShipment(
  { state, occurredAt, nextId }: DemoWriteContext,
  shipmentId: EntityId,
  nextStatus: ShipmentStatus,
  stopId?: EntityId,
): StateUpdate<Shipment> {
  const context = getSessionContext(state);
  const shipment = findShipment(state, shipmentId);
  assertCanOperateShipment(context, shipment);

  if (nextStatus === "accepted" || nextStatus === "declined") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Use the tender response action to accept or decline a load.",
    );
  }
  if (nextStatus === "delivered") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Proof of delivery is required before a load can be delivered.",
    );
  }
  if (nextStatus === "exception") {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Use the exception report action to place a load in exception status.",
    );
  }
  const driverAcceptingAssignment = nextStatus === "dispatched"
    && context.effectiveRole === "driver"
    && shipment.assignedDriverId === context.driverId;
  if ((nextStatus === "dispatched" || nextStatus === "cancelled") && context.effectiveRole !== "admin" && !driverAcceptingAssignment) {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "Only an admin can dispatch or cancel a load.",
    );
  }
  if (nextStatus === "dispatched" && !shipment.assignedDriverId) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "Assign a driver before dispatching this load.",
    );
  }

  const transitioned = transitionShipmentStatus(shipment, nextStatus, {
    eventId: nextId("event"),
    occurredAt,
    source: eventSourceForRole(context.effectiveRole),
    stopId,
    coordinates: currentCoordinates(state, context),
  });
  let nextState = replaceShipment(state, transitioned, occurredAt);

  if (isOperationalStatus(nextStatus)) {
    nextState = appendEdiTransaction(
      nextState,
      createEdiTransaction(
        nextId("edi"),
        transitioned,
        "214",
        `Shipment status: ${nextStatus.replaceAll("_", " ")}`,
        occurredAt,
      ),
      occurredAt,
    );
  }
  return { state: nextState, result: transitioned };
}
