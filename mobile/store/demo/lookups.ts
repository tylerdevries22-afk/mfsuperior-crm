import { OperationsDomainError } from "../../domain/errors";
import type {
  DemoOperationsState,
  Driver,
  DriverShift,
  EntityId,
  Shipment,
  Vehicle,
} from "../../domain/types";

export function findDriver(state: DemoOperationsState, driverId: EntityId): Driver {
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  if (!driver) {
    throw new OperationsDomainError("NOT_FOUND", "The driver could not be found.", { driverId });
  }
  return driver;
}

export function findDriverShift(state: DemoOperationsState, shiftId: EntityId): DriverShift {
  const shift = state.driverShifts.find((candidate) => candidate.id === shiftId);
  if (!shift) {
    throw new OperationsDomainError("NOT_FOUND", "The driver shift could not be found.");
  }
  return shift;
}

export function findVehicle(state: DemoOperationsState, vehicleId: EntityId): Vehicle {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) {
    throw new OperationsDomainError("NOT_FOUND", "The vehicle could not be found.", { vehicleId });
  }
  return vehicle;
}

export function findShipment(state: DemoOperationsState, shipmentId: EntityId): Shipment {
  const shipment = state.shipments.find((candidate) => candidate.id === shipmentId);
  if (!shipment) {
    throw new OperationsDomainError("NOT_FOUND", "The shipment could not be found.", { shipmentId });
  }
  return shipment;
}
