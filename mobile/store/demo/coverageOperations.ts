import { OperationsDomainError } from "../../domain/errors";
import { eligibleCoverageDrivers } from "../../domain/scheduling";
import type {
  DemoOperationsState,
  DriverShift,
  EntityId,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
} from "../../domain/types";
import {
  getSessionContext,
  requireDriverId,
  type DemoWriteContext,
  type StateUpdate,
} from "./context";
import { findDriverShift } from "./lookups";
import { scheduleSyncForShift } from "./shiftOperations";

export function requestShiftCoverage(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: ShiftCoverageRequestInput,
): StateUpdate<ShiftCoverageRequest> {
  const context = getSessionContext(state);
  const shift = findDriverShift(state, input.shiftId);
  if (context.effectiveRole === "driver" && shift.driverId !== requireDriverId(context)) {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "A driver can only request coverage for their own shift.",
    );
  }
  if (Date.parse(shift.startsAt) <= Date.parse(occurredAt)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "Only future shifts can be sent for coverage.",
    );
  }
  const target = eligibleCoverageDrivers(state, shift).find(
    (candidate) => candidate.driver.id === input.targetDriverId,
  );
  if (!target) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "That driver is no longer qualified, available, or conflict-free for this shift.",
    );
  }
  if (state.shiftCoverageRequests.some((request) => (
    request.shiftId === input.shiftId &&
    request.targetDriverId === input.targetDriverId &&
    request.status === "pending"
  ))) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "A coverage request is already waiting for that driver.",
    );
  }

  const request: ShiftCoverageRequest = {
    createdAt: occurredAt,
    fromDriverId: shift.driverId,
    id: nextId("coverage"),
    requestedByAccountId: context.account.id,
    shiftId: shift.id,
    status: "pending",
    targetDriverId: target.driver.id,
  };
  return {
    result: request,
    state: {
      ...state,
      shiftCoverageRequests: [...state.shiftCoverageRequests, request],
      updatedAt: occurredAt,
    },
  };
}

export function respondToShiftCoverage(
  { state, occurredAt }: DemoWriteContext,
  requestId: EntityId,
  response: "accepted" | "declined",
): StateUpdate<ShiftCoverageRequest> {
  const context = getSessionContext(state);
  const request = state.shiftCoverageRequests.find((candidate) => candidate.id === requestId);
  if (!request) {
    throw new OperationsDomainError("NOT_FOUND", "That coverage request could not be found.");
  }
  if (request.status !== "pending") {
    throw new OperationsDomainError("INVALID_TRANSITION", "That coverage request is already closed.");
  }
  if (context.effectiveRole === "driver" && request.targetDriverId !== requireDriverId(context)) {
    throw new OperationsDomainError("UNAUTHORIZED", "This coverage request is assigned to another driver.");
  }
  const shift = findDriverShift(state, request.shiftId);
  if (response === "accepted") {
    const eligible = eligibleCoverageDrivers(state, shift).some(
      (candidate) => candidate.driver.id === request.targetDriverId,
    );
    if (!eligible) {
      throw new OperationsDomainError(
        "VALIDATION_FAILED",
        "This driver is no longer eligible for the shift.",
      );
    }
  }

  const updatedRequest: ShiftCoverageRequest = {
    ...request,
    respondedAt: occurredAt,
    status: response,
  };
  let nextState: DemoOperationsState = {
    ...state,
    shiftCoverageRequests: state.shiftCoverageRequests.map((candidate) => (
      candidate.id === request.id
        ? updatedRequest
        : response === "accepted" && candidate.shiftId === request.shiftId && candidate.status === "pending"
          ? { ...candidate, respondedAt: occurredAt, status: "closed" }
          : candidate
    )),
    updatedAt: occurredAt,
  };
  if (response === "accepted") {
    const transferred: DriverShift = { ...shift, driverId: request.targetDriverId, updatedAt: occurredAt };
    const sync = scheduleSyncForShift(nextState.scheduleSyncStatuses, shift.id, occurredAt);
    nextState = {
      ...nextState,
      driverShifts: nextState.driverShifts.map((candidate) => (
        candidate.id === shift.id ? transferred : candidate
      )),
      scheduleSyncStatuses: [
        ...nextState.scheduleSyncStatuses.filter((candidate) => candidate.entityId !== shift.id),
        sync,
      ],
    };
  }
  return { result: updatedRequest, state: nextState };
}
