import { OperationsDomainError } from "../../domain/errors";
import type {
  AppRole,
  DemoOperationsState,
  EntityId,
  GeoPoint,
  Shipment,
  ShipmentEventSource,
  ShipmentStatus,
} from "../../domain/types";
import type { SessionContext } from "./context";

export const ACTIVE_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
]);

const RESERVED_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  "accepted",
  ...ACTIVE_SHIPMENT_STATUSES,
]);

export function assertCanOperateShipment(context: SessionContext, shipment: Shipment): void {
  if (context.effectiveRole === "admin") {
    return;
  }
  if (context.effectiveRole === "driver" && shipment.assignedDriverId === context.driverId) {
    return;
  }
  throw new OperationsDomainError(
    "UNAUTHORIZED",
    "This role cannot update the selected shipment.",
    { shipmentId: shipment.id },
  );
}

export function replaceShipment(
  state: DemoOperationsState,
  shipment: Shipment,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    shipments: state.shipments.map((candidate) => candidate.id === shipment.id ? shipment : candidate),
    updatedAt: occurredAt,
  };
}

export function assertDriverAssignable(
  state: DemoOperationsState,
  shipment: Shipment,
  driverId: EntityId,
): void {
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  if (!driver) {
    throw new OperationsDomainError("NOT_FOUND", "The selected driver could not be found.");
  }
  if (driver.status === "suspended") {
    throw new OperationsDomainError("VALIDATION_FAILED", "The selected driver is suspended.");
  }
  const conflict = state.shipments.find((candidate) =>
    candidate.id !== shipment.id
    && candidate.assignedDriverId === driverId
    && RESERVED_SHIPMENT_STATUSES.has(candidate.status));
  if (conflict) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `The selected driver is already assigned to ${conflict.loadNumber}.`,
      { shipmentId: conflict.id, driverId },
    );
  }
}

export function currentCoordinates(
  state: DemoOperationsState,
  context: SessionContext,
): GeoPoint | undefined {
  return context.driverId
    ? state.drivers.find((driver) => driver.id === context.driverId)?.currentLocation
    : undefined;
}

export function eventSourceForRole(role: AppRole): ShipmentEventSource {
  return role;
}

export function isOperationalStatus(status: ShipmentStatus): boolean {
  return status === "dispatched" || ACTIVE_SHIPMENT_STATUSES.has(status) || status === "cancelled";
}
