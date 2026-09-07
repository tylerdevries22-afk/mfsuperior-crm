import {
  hasStringId,
  isFiniteNumber,
  isIsoDateTime,
  isNonEmptyString,
  isNonNegativeNumber,
} from "./primitives";
import {
  availabilityKindSet,
  coverageRequestStatusSet,
  driverShiftStatusSet,
  scheduleSyncStatusSet,
} from "./statusSets";

export function isAvailabilityBlock(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.driverId) &&
    typeof value.kind === "string" &&
    availabilityKindSet.has(value.kind) &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    Date.parse(value.endsAt) > Date.parse(value.startsAt)
  );
}

export function isAvailabilityRule(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.driverId) &&
    typeof value.kind === "string" &&
    availabilityKindSet.has(value.kind) &&
    isFiniteNumber(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    isNonNegativeNumber(value.startMinute) &&
    isNonNegativeNumber(value.endMinute) &&
    value.endMinute > value.startMinute &&
    value.endMinute <= 1440 &&
    isIsoDateTime(value.effectiveFrom)
  );
}

export function isDriverShift(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.driverId) &&
    typeof value.status === "string" &&
    driverShiftStatusSet.has(value.status) &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
    (value.note === undefined || typeof value.note === "string")
  );
}

export function isShiftCoverageRequest(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.shiftId) &&
    isNonEmptyString(value.fromDriverId) &&
    isNonEmptyString(value.targetDriverId) &&
    isNonEmptyString(value.requestedByAccountId) &&
    typeof value.status === "string" &&
    coverageRequestStatusSet.has(value.status) &&
    isIsoDateTime(value.createdAt) &&
    (value.respondedAt === undefined || isIsoDateTime(value.respondedAt))
  );
}

export function isScheduleSyncStatus(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    value.entityType === "shift" &&
    isNonEmptyString(value.entityId) &&
    value.provider === "target" &&
    typeof value.status === "string" &&
    scheduleSyncStatusSet.has(value.status) &&
    isNonNegativeNumber(value.attempts) &&
    (value.lastAttemptAt === undefined || isIsoDateTime(value.lastAttemptAt)) &&
    (value.lastError === undefined || typeof value.lastError === "string") &&
    isIsoDateTime(value.updatedAt)
  );
}
