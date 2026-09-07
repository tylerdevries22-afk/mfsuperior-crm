import { OperationsDomainError } from "../../domain/errors";
import { driverShiftConflict, shiftInputToRecord } from "../../domain/scheduling";
import type {
  DemoOperationsState,
  DriverShift,
  DriverShiftInput,
  EntityId,
  ScheduleSyncStatus,
} from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { findDriver, findDriverShift } from "./lookups";
import { normalizedIsoDateTime } from "./validation";

export function setDriverShift(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: DriverShiftInput,
): StateUpdate<DriverShift> {
  requireRole(getSessionContext(state), "admin", "Only an admin can manage driver shifts.");
  findDriver(state, input.driverId);
  const startsAt = normalizedIsoDateTime(input.startsAt);
  const endsAt = normalizedIsoDateTime(input.endsAt);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "A shift has to end after it starts.",
    );
  }

  const existing = input.id
    ? state.driverShifts.find((shift) => shift.id === input.id)
    : undefined;
  if (input.id && !existing) {
    throw new OperationsDomainError("NOT_FOUND", "That driver shift could not be found.");
  }
  const shift = shiftInputToRecord(
    {
      ...input,
      endsAt,
      startsAt,
      status: input.status ?? existing?.status,
    },
    existing?.id ?? nextId("shift"),
    occurredAt,
  );
  const conflict = driverShiftConflict(state, shift);
  if (conflict) {
    throw new OperationsDomainError("VALIDATION_FAILED", conflict);
  }

  const sync = scheduleSyncForShift(state.scheduleSyncStatuses, shift.id, occurredAt);
  const nextState: DemoOperationsState = {
    ...state,
    driverShifts: [...state.driverShifts.filter((candidate) => candidate.id !== shift.id), shift],
    scheduleSyncStatuses: [
      ...state.scheduleSyncStatuses.filter((candidate) => candidate.entityId !== shift.id),
      sync,
    ],
    updatedAt: occurredAt,
  };
  return { result: shift, state: nextState };
}

export function removeDriverShift(
  { state, occurredAt }: DemoWriteContext,
  shiftId: EntityId,
): StateUpdate<DemoOperationsState> {
  requireRole(getSessionContext(state), "admin", "Only an admin can remove driver shifts.");
  findDriverShift(state, shiftId);
  const nextState: DemoOperationsState = {
    ...state,
    driverShifts: state.driverShifts.filter((shift) => shift.id !== shiftId),
    shiftCoverageRequests: state.shiftCoverageRequests.map((request) => (
      request.shiftId === shiftId && request.status === "pending"
        ? { ...request, status: "closed", respondedAt: occurredAt }
        : request
    )),
    scheduleSyncStatuses: state.scheduleSyncStatuses.filter((sync) => sync.entityId !== shiftId),
    updatedAt: occurredAt,
  };
  return { result: nextState, state: nextState };
}

export function retryScheduleSync(
  { state, occurredAt, nextId }: DemoWriteContext,
  shiftId: EntityId,
): StateUpdate<ScheduleSyncStatus> {
  requireRole(getSessionContext(state), "admin", "Only an admin can retry Target sync.");
  findDriverShift(state, shiftId);
  const current = state.scheduleSyncStatuses.find((candidate) => candidate.entityId === shiftId);
  const sync: ScheduleSyncStatus = {
    ...(current ?? {
      entityType: "shift" as const,
      id: nextId("sync"),
      entityId: shiftId,
      provider: "target" as const,
      status: "pending" as const,
      attempts: 0,
      updatedAt: occurredAt,
    }),
    attempts: (current?.attempts ?? 0) + 1,
    lastAttemptAt: occurredAt,
    lastError: "Target credentials are not configured yet.",
    status: "pending",
    updatedAt: occurredAt,
  };
  return {
    result: sync,
    state: {
      ...state,
      scheduleSyncStatuses: [
        ...state.scheduleSyncStatuses.filter((candidate) => candidate.entityId !== shiftId),
        sync,
      ],
      updatedAt: occurredAt,
    },
  };
}

export function scheduleSyncForShift(
  statuses: readonly ScheduleSyncStatus[],
  shiftId: EntityId,
  occurredAt: string,
): ScheduleSyncStatus {
  const existing = statuses.find((candidate) => candidate.entityId === shiftId);
  return {
    ...(existing ?? {
      entityType: "shift" as const,
      entityId: shiftId,
      id: `sync-${shiftId}`,
      provider: "target" as const,
      attempts: 0,
    }),
    lastError: undefined,
    status: "pending",
    updatedAt: occurredAt,
  };
}
