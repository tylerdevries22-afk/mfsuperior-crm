import { OperationsDomainError } from "../../domain/errors";
import { transitionHosStatus } from "../../domain/transitions";
import type { DemoOperationsState, GeoPoint, HosDutyStatus } from "../../domain/types";
import {
  getSessionContext,
  requireDriverId,
  requireRole,
  type DemoWriteContext,
  type StateUpdate,
} from "./context";
import { ACTIVE_SHIPMENT_STATUSES } from "./shipmentSupport";
import { validateCoordinates } from "./validation";

export function transitionDutyStatus(
  { state, occurredAt, nextId }: DemoWriteContext,
  nextStatus: HosDutyStatus,
): StateUpdate<DemoOperationsState> {
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to update HOS status.");
  const driverId = requireDriverId(context);
  const clock = state.hosClocks.find((candidate) => candidate.driverId === driverId);
  if (!clock) {
    throw new OperationsDomainError("NOT_FOUND", "The driver's HOS clock could not be found.");
  }

  const activeShipment = state.shipments.find(
    (shipment) => shipment.assignedDriverId === driverId && ACTIVE_SHIPMENT_STATUSES.has(shipment.status),
  );
  const transitioned = transitionHosStatus(clock, nextStatus, {
    entryId: nextId("hos"),
    occurredAt,
    locationDescription: activeShipment
      ? activeShipment.stops.find((stop) => stop.status !== "completed")?.facilityName ?? "Current route"
      : "Current recorded location",
    hasActiveShipment: Boolean(activeShipment),
  });
  const nextState: DemoOperationsState = {
    ...state,
    hosClocks: state.hosClocks.map((candidate) => candidate.driverId === driverId ? transitioned : candidate),
    updatedAt: occurredAt,
  };
  return { state: nextState, result: nextState };
}

export function recordDriverLocation(
  { state, occurredAt, nextId }: DemoWriteContext,
  coordinates: GeoPoint,
): StateUpdate<DemoOperationsState> {
  validateCoordinates(coordinates);
  const context = getSessionContext(state);
  requireRole(context, "driver", "A Driver role is required to record GPS movement.");
  const driverId = requireDriverId(context);
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  if (!driver) {
    throw new OperationsDomainError("NOT_FOUND", "The driver could not be found.");
  }

  const activeShipment = state.shipments.find(
    (shipment) => shipment.assignedDriverId === driverId && ACTIVE_SHIPMENT_STATUSES.has(shipment.status),
  );
  const updatedShipment = activeShipment
    ? {
        ...activeShipment,
        events: [
          ...activeShipment.events,
          {
            id: nextId("event"),
            shipmentId: activeShipment.id,
            type: "location_update" as const,
            eventCode: "LX",
            source: "driver" as const,
            occurredAt,
            description: "Simulated driver location updated",
            coordinates,
            isSimulated: true as const,
          },
        ],
        updatedAt: occurredAt,
      }
    : null;
  const nextState: DemoOperationsState = {
    ...state,
    drivers: state.drivers.map((candidate) => candidate.id === driverId
      ? { ...candidate, currentLocation: coordinates, locationUpdatedAt: occurredAt }
      : candidate),
    shipments: updatedShipment
      ? state.shipments.map((shipment) => shipment.id === updatedShipment.id ? updatedShipment : shipment)
      : state.shipments,
    updatedAt: occurredAt,
  };
  return { state: nextState, result: nextState };
}
