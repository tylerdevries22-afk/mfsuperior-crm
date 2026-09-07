import { OperationsDomainError } from "../../domain/errors";
import type {
  EntityId,
  MaintenanceOrder,
  MaintenanceOrderInput,
  MaintenanceOrderPatch,
} from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { findDriver, findVehicle } from "./lookups";
import { normalizedIsoDateTime } from "./validation";

export function createMaintenanceOrder(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: MaintenanceOrderInput,
): StateUpdate<MaintenanceOrder> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to open a work order.",
  );
  const vehicle = findVehicle(state, input.vehicleId);
  if (input.reportedByDriverId) {
    findDriver(state, input.reportedByDriverId);
  }

  const order: MaintenanceOrder = {
    costCents: input.costCents,
    description: input.description,
    id: nextId("maintenance"),
    kind: input.kind,
    odometerMiles: input.odometerMiles ?? vehicle.odometerMiles,
    openedAt: occurredAt,
    reportedByDriverId: input.reportedByDriverId,
    scheduledFor: input.scheduledFor ? normalizedIsoDateTime(input.scheduledFor) : undefined,
    severity: input.severity,
    status: input.scheduledFor ? "scheduled" : "open",
    summary: input.summary,
    updatedAt: occurredAt,
    vehicleId: vehicle.id,
    vendorName: input.vendorName,
  };

  // A critical repair takes the unit off the board and off its driver, so
  // the fleet screen and the dispatch board cannot disagree about whether
  // the truck can run.
  const grounded = order.severity === "critical";
  return {
    result: order,
    state: {
      ...state,
      maintenanceOrders: [...state.maintenanceOrders, order],
      updatedAt: occurredAt,
      vehicles: grounded
        ? state.vehicles.map((candidate) => candidate.id === vehicle.id
            ? { ...candidate, assignedDriverId: undefined, status: "out_of_service" as const, updatedAt: occurredAt }
            : candidate)
        : state.vehicles,
    },
  };
}

export function updateMaintenanceOrder(
  { state, occurredAt }: DemoWriteContext,
  orderId: EntityId,
  patch: MaintenanceOrderPatch,
): StateUpdate<MaintenanceOrder> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to update a work order.",
  );
  const order = state.maintenanceOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new OperationsDomainError("NOT_FOUND", "That work order could not be found.");
  }
  if (order.status === "completed" || order.status === "cancelled") {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "A closed work order cannot be changed. Open a new one instead.",
    );
  }

  const status = patch.status ?? order.status;
  const updated: MaintenanceOrder = {
    ...order,
    completedAt: status === "completed"
      ? patch.completedAt ? normalizedIsoDateTime(patch.completedAt) : occurredAt
      : order.completedAt,
    costCents: patch.costCents ?? order.costCents,
    description: patch.description ?? order.description,
    scheduledFor: patch.scheduledFor
      ? normalizedIsoDateTime(patch.scheduledFor)
      : order.scheduledFor,
    severity: patch.severity ?? order.severity,
    status,
    updatedAt: occurredAt,
    vendorName: patch.vendorName ?? order.vendorName,
  };

  // Closing the last open order on a unit puts it back in service.
  const stillDown = state.maintenanceOrders.some(
    (candidate) => candidate.vehicleId === order.vehicleId &&
      candidate.id !== order.id &&
      candidate.status !== "completed" &&
      candidate.status !== "cancelled",
  );
  const releaseVehicle = (status === "completed" || status === "cancelled") && !stillDown;

  return {
    result: updated,
    state: {
      ...state,
      maintenanceOrders: state.maintenanceOrders.map(
        (candidate) => candidate.id === updated.id ? updated : candidate,
      ),
      updatedAt: occurredAt,
      vehicles: releaseVehicle
        ? state.vehicles.map((candidate) => candidate.id === order.vehicleId && candidate.status !== "retired"
            ? { ...candidate, status: "active" as const, updatedAt: occurredAt }
            : candidate)
        : state.vehicles,
    },
  };
}
