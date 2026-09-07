import { OperationsDomainError } from "../../domain/errors";
import type { EntityId, IsoDateTime, Shipment, ShipmentEvent } from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { addMinutes } from "./validation";

export function addDemoUnassignedLoad(
  { state, occurredAt, nextId }: DemoWriteContext,
): StateUpdate<Shipment> {
  const context = getSessionContext(state);
  requireRole(context, "admin", "Only an admin can add a demo load.");
  const template = state.shipments.find((shipment) => shipment.status === "tendered")
    ?? state.shipments.find((shipment) => !shipment.assignedDriverId);
  if (!template) {
    throw new OperationsDomainError("NOT_FOUND", "No shipment template is available for the demo load.");
  }

  const shipmentId = nextDemoShipmentId(state.shipments, occurredAt);
  const shipment: Shipment = {
    ...template,
    id: shipmentId,
    loadNumber: nextDemoLoadNumber(state.shipments),
    purchaseOrderNumber: `${shipmentId}-PO`,
    billOfLadingNumber: `${shipmentId}-BOL`,
    proNumber: `${shipmentId}-PRO`,
    assignedDriverId: undefined,
    status: "accepted",
    stops: createDemoStops(template, shipmentId, occurredAt),
    events: [createDemoAcceptanceEvent(nextId("event"), shipmentId, occurredAt)],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  return {
    result: shipment,
    state: { ...state, shipments: [...state.shipments, shipment], updatedAt: occurredAt },
  };
}

function nextDemoShipmentId(
  shipments: readonly Shipment[],
  occurredAt: IsoDateTime,
): EntityId {
  const timestamp = Date.parse(occurredAt);
  let ordinal = 1;
  let id = `shipment-demo-${timestamp}-${ordinal}`;
  while (shipments.some((shipment) => shipment.id === id)) {
    ordinal += 1;
    id = `shipment-demo-${timestamp}-${ordinal}`;
  }
  return id;
}

function nextDemoLoadNumber(shipments: readonly Shipment[]): string {
  const highest = shipments.reduce((currentHighest, shipment) => {
    const match = /^MF-DEMO-(\d+)$/.exec(shipment.loadNumber);
    return match ? Math.max(currentHighest, Number(match[1])) : currentHighest;
  }, 0);
  return `MF-DEMO-${String(highest + 1).padStart(3, "0")}`;
}

function createDemoStops(
  template: Shipment,
  shipmentId: EntityId,
  occurredAt: IsoDateTime,
): Shipment["stops"] {
  const pickup = template.stops.find((stop) => stop.type === "pickup") ?? template.stops[0];
  const delivery = template.stops.find((stop) => stop.type === "delivery") ?? template.stops.at(-1);
  if (!pickup || !delivery) {
    throw new OperationsDomainError("VALIDATION_FAILED", "The demo shipment template has no route stops.");
  }

  const pickupStart = addMinutes(occurredAt, 90);
  const deliveryStart = addMinutes(occurredAt, 540);
  return [
    createDemoStop(pickup, `${shipmentId}-pickup`, 1, pickupStart, addMinutes(pickupStart, 60)),
    createDemoStop(delivery, `${shipmentId}-delivery`, 2, deliveryStart, addMinutes(deliveryStart, 60)),
  ];
}

function createDemoStop(
  template: Shipment["stops"][number],
  id: EntityId,
  sequence: number,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
): Shipment["stops"][number] {
  return {
    ...template,
    id,
    sequence,
    status: "pending",
    appointment: { ...template.appointment, startsAt, endsAt },
    arrivedAt: undefined,
    completedAt: undefined,
  };
}

function createDemoAcceptanceEvent(
  id: EntityId,
  shipmentId: EntityId,
  occurredAt: IsoDateTime,
): ShipmentEvent {
  return {
    id,
    shipmentId,
    type: "tender_accepted",
    eventCode: "990",
    source: "admin",
    occurredAt,
    description: "Demo load accepted and waiting for driver assignment.",
    resultingStatus: "accepted",
    isSimulated: true,
  };
}
