import {
  hasStringId,
  isFiniteNumber,
  isIsoDateTime,
  isNonEmptyString,
  isNonNegativeNumber,
  isRecord,
} from "./primitives";
import { dutyStatusSet, roleSet, shipmentStatusSet } from "./statusSets";

export function isSession(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const accountIdIsValid = value.accountId === null || typeof value.accountId === "string";
  const roleIsValid = value.effectiveRole === null || (
    typeof value.effectiveRole === "string" && roleSet.has(value.effectiveRole)
  );
  return accountIdIsValid && roleIsValid;
}

export function isAccount(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    typeof value.role === "string" &&
    roleSet.has(value.role) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.email) &&
    (value.demoPin === undefined || (
      typeof value.demoPin === "string" && /^\d{4}$/.test(value.demoPin)
    ))
  );
}

export function isDriver(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.firstName) &&
    isNonEmptyString(value.lastName) &&
    isRecord(value.currentLocation) &&
    isFiniteNumber(value.currentLocation.latitude) &&
    isFiniteNumber(value.currentLocation.longitude)
  );
}

export function isShipment(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.loadNumber) &&
    typeof value.status === "string" &&
    shipmentStatusSet.has(value.status) &&
    Array.isArray(value.stops) &&
    value.stops.every(isStop) &&
    Array.isArray(value.events) &&
    value.events.every(isShipmentEvent) &&
    isIsoDateTime(value.updatedAt)
  );
}

function isStop(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStringId(value) &&
    typeof value.sequence === "number" &&
    isNonEmptyString(value.facilityName) &&
    isRecord(value.address) &&
    isRecord(value.coordinates) &&
    isFiniteNumber(value.coordinates.latitude) &&
    isFiniteNumber(value.coordinates.longitude) &&
    isRecord(value.appointment) &&
    isIsoDateTime(value.appointment.startsAt) &&
    isIsoDateTime(value.appointment.endsAt)
  );
}

function isShipmentEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStringId(value) &&
    isNonEmptyString(value.shipmentId) &&
    isIsoDateTime(value.occurredAt) &&
    typeof value.isSimulated === "boolean"
  );
}

export function isHosClock(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.driverId) &&
    typeof value.status === "string" &&
    dutyStatusSet.has(value.status) &&
    isIsoDateTime(value.statusStartedAt) &&
    isNonNegativeNumber(value.drivingMinutesUsed) &&
    isNonNegativeNumber(value.shiftMinutesUsed) &&
    isNonNegativeNumber(value.cycleMinutesUsed) &&
    isNonNegativeNumber(value.minutesSinceQualifyingBreak) &&
    Array.isArray(value.entries)
  );
}

export function hasValidSessionAccount(state: Record<string, unknown>): boolean {
  const session = state.session;
  const accounts = state.accounts;
  if (!isRecord(session) || !Array.isArray(accounts)) {
    return false;
  }

  if (session.accountId === null) {
    return session.effectiveRole === null;
  }

  const account = accounts.find(
    (candidate) => isRecord(candidate) && candidate.id === session.accountId,
  );
  if (!isRecord(account) || typeof account.role !== "string") {
    return false;
  }

  return account.role === "admin"
    ? typeof session.effectiveRole === "string" && roleSet.has(session.effectiveRole)
    : session.effectiveRole === account.role;
}
