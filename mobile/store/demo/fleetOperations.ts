import { OperationsDomainError } from "../../domain/errors";
import type { EntityId, Vehicle, VehicleInput, VehicleThumbnailSource } from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { findDriver, findVehicle } from "./lookups";

export function upsertVehicle(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: VehicleInput,
): StateUpdate<Vehicle> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to manage the fleet.",
  );
  const existing = input.id
    ? state.vehicles.find((candidate) => candidate.id === input.id)
    : undefined;
  if (input.id && !existing) {
    throw new OperationsDomainError("NOT_FOUND", "That vehicle could not be found.");
  }

  const unitNumber = input.unitNumber.trim();
  if (unitNumber.length === 0) {
    throw new OperationsDomainError("VALIDATION_FAILED", "A vehicle needs a unit number.");
  }
  // Unit numbers are how the shop, the driver, and dispatch all refer to
  // the same truck, so two units may never share one.
  const duplicate = state.vehicles.find(
    (candidate) => candidate.id !== existing?.id &&
      candidate.unitNumber.toLowerCase() === unitNumber.toLowerCase(),
  );
  if (duplicate) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `Unit ${unitNumber} is already in the fleet.`,
    );
  }
  if (input.assignedDriverId) {
    findDriver(state, input.assignedDriverId);
  }

  const vehicle: Vehicle = {
    assignedDriverId: input.assignedDriverId,
    createdAt: existing?.createdAt ?? occurredAt,
    id: existing?.id ?? nextId("vehicle"),
    make: input.make,
    model: input.model,
    odometerMiles: Math.max(0, Math.round(input.odometerMiles)),
    plateNumber: input.plateNumber,
    plateState: input.plateState,
    status: input.status,
    thumbnailUrl: input.thumbnailUrl ?? existing?.thumbnailUrl ?? null,
    type: input.type,
    unitNumber,
    updatedAt: occurredAt,
    vin: input.vin.trim().toUpperCase(),
    year: input.year,
  };

  const others = state.vehicles.filter((candidate) => candidate.id !== vehicle.id);
  return {
    result: vehicle,
    state: { ...state, updatedAt: occurredAt, vehicles: [...others, vehicle] },
  };
}

export function assignVehicle(
  { state, occurredAt }: DemoWriteContext,
  vehicleId: EntityId,
  driverId: EntityId | null,
): StateUpdate<Vehicle> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to assign a vehicle.",
  );
  const vehicle = findVehicle(state, vehicleId);
  if (driverId) {
    findDriver(state, driverId);
    // A truck in the shop cannot be handed to a driver who would then be
    // dispatched on it.
    if (vehicle.status === "in_shop" || vehicle.status === "out_of_service") {
      throw new OperationsDomainError(
        "VALIDATION_FAILED",
        `Unit ${vehicle.unitNumber} is ${vehicle.status === "in_shop" ? "in the shop" : "out of service"} and cannot be assigned.`,
      );
    }
  }

  const updated: Vehicle = {
    ...vehicle,
    assignedDriverId: driverId ?? undefined,
    updatedAt: occurredAt,
  };
  return {
    result: updated,
    state: {
      ...state,
      updatedAt: occurredAt,
      vehicles: state.vehicles.map((candidate) => candidate.id === updated.id ? updated : candidate),
    },
  };
}

export function transferVehicle(
  { state, occurredAt }: DemoWriteContext,
  vehicleId: EntityId,
  targetDriverId: EntityId,
  note: string,
): StateUpdate<Vehicle> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to transfer a vehicle.",
  );
  if (note.trim().length > 1_000) {
    throw new OperationsDomainError("VALIDATION_FAILED", "Transfer notes are too long.");
  }
  const vehicle = findVehicle(state, vehicleId);
  if (vehicle.status !== "active") {
    throw new OperationsDomainError("VALIDATION_FAILED", "Only an active vehicle can be transferred.");
  }
  if (vehicle.assignedDriverId === targetDriverId) {
    throw new OperationsDomainError("VALIDATION_FAILED", "Choose a different driver for the transfer.");
  }
  findDriver(state, targetDriverId);
  const updated: Vehicle = {
    ...vehicle,
    assignedDriverId: targetDriverId,
    updatedAt: occurredAt,
  };
  return {
    result: updated,
    state: {
      ...state,
      updatedAt: occurredAt,
      vehicles: state.vehicles.map((candidate) => candidate.id === vehicleId ? updated : candidate),
    },
  };
}

export function updateVehicleThumbnail(
  { state, occurredAt }: DemoWriteContext,
  vehicleId: EntityId,
  source: VehicleThumbnailSource,
): StateUpdate<Vehicle> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to manage vehicle thumbnails.",
  );
  const vehicle = findVehicle(state, vehicleId);
  const updated: Vehicle = { ...vehicle, thumbnailUrl: source.uri, updatedAt: occurredAt };
  return {
    result: updated,
    state: {
      ...state,
      updatedAt: occurredAt,
      vehicles: state.vehicles.map((candidate) => candidate.id === vehicleId ? updated : candidate),
    },
  };
}
