import { OperationsDomainError } from "../errors";
import type {
  GeoPoint,
  Shipment,
  ShipmentEvent,
  ShipmentEventSource,
  ShipmentEventType,
  ShipmentStatus,
} from "../types";
import { updateStopsForShipmentStatus } from "./shipmentStops";
import { parseIsoDateTime } from "./time";

const SHIPMENT_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  tendered: ["accepted", "declined", "cancelled"],
  accepted: ["dispatched", "cancelled"],
  declined: [],
  dispatched: ["at_pickup", "exception", "cancelled"],
  at_pickup: ["loaded", "exception", "cancelled"],
  loaded: ["in_transit", "exception", "cancelled"],
  in_transit: ["at_delivery", "exception", "cancelled"],
  at_delivery: ["delivered", "exception", "cancelled"],
  delivered: [],
  exception: ["dispatched", "at_pickup", "loaded", "in_transit", "at_delivery", "cancelled"],
  cancelled: [],
};

interface ShipmentTransitionDefinition {
  readonly eventType: ShipmentEventType;
  readonly eventCode: string;
  readonly description: string;
}

const SHIPMENT_EVENT_DEFINITIONS: Readonly<
  Partial<Record<ShipmentStatus, ShipmentTransitionDefinition>>
> = {
  accepted: {
    eventType: "tender_accepted",
    eventCode: "990",
    description: "Load tender accepted",
  },
  declined: {
    eventType: "tender_declined",
    eventCode: "990",
    description: "Load tender declined",
  },
  dispatched: {
    eventType: "dispatched",
    eventCode: "AF",
    description: "Driver dispatched",
  },
  at_pickup: {
    eventType: "arrived_at_pickup",
    eventCode: "X1",
    description: "Driver arrived at pickup",
  },
  loaded: {
    eventType: "loaded",
    eventCode: "X3",
    description: "Freight loaded and pickup completed",
  },
  in_transit: {
    eventType: "departed_pickup",
    eventCode: "D1",
    description: "Shipment in transit",
  },
  at_delivery: {
    eventType: "arrived_at_delivery",
    eventCode: "CD",
    description: "Driver arrived at delivery",
  },
  delivered: {
    eventType: "delivered",
    eventCode: "CL",
    description: "Shipment delivered",
  },
  exception: {
    eventType: "exception_reported",
    eventCode: "SD",
    description: "Shipment exception reported",
  },
  cancelled: {
    eventType: "cancelled",
    eventCode: "CA",
    description: "Shipment cancelled",
  },
};

export interface ShipmentTransitionContext {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly source: ShipmentEventSource;
  readonly description?: string;
  readonly stopId?: string;
  readonly coordinates?: GeoPoint;
}

export function canTransitionShipment(
  currentStatus: ShipmentStatus,
  nextStatus: ShipmentStatus,
): boolean {
  return SHIPMENT_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function transitionShipmentStatus(
  shipment: Shipment,
  nextStatus: ShipmentStatus,
  context: ShipmentTransitionContext,
): Shipment {
  if (!canTransitionShipment(shipment.status, nextStatus)) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      `A shipment cannot move from ${shipment.status} to ${nextStatus}.`,
      { shipmentId: shipment.id, currentStatus: shipment.status, nextStatus },
    );
  }

  const eventDefinition = SHIPMENT_EVENT_DEFINITIONS[nextStatus];
  if (!eventDefinition) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "No shipment event is defined for this status change.",
      { nextStatus },
    );
  }

  const occurredAt = parseIsoDateTime(context.occurredAt, "occurredAt").toISOString();
  const updatedStops = updateStopsForShipmentStatus(shipment.stops, nextStatus, context.stopId, occurredAt);
  const event: ShipmentEvent = {
    id: context.eventId,
    shipmentId: shipment.id,
    type: eventDefinition.eventType,
    eventCode: eventDefinition.eventCode,
    source: context.source,
    occurredAt,
    description: context.description?.trim() || eventDefinition.description,
    resultingStatus: nextStatus,
    stopId: context.stopId,
    coordinates: context.coordinates,
    isSimulated: true,
  };

  return {
    ...shipment,
    status: nextStatus,
    stops: updatedStops,
    events: [...shipment.events, event],
    updatedAt: occurredAt,
  };
}
