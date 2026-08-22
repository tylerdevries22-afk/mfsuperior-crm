import { OperationsDomainError } from "../domain/errors";
import {
  APP_ROLES,
  AVAILABILITY_KINDS,
  DEMO_STATE_VERSION,
  HOS_DUTY_STATUSES,
  PAYOUT_STATUSES,
  SHIPMENT_STATUSES,
  VEHICLE_STATUSES,
  type DemoOperationsState,
} from "../domain/types";

const roleSet = new Set<string>(APP_ROLES);
const shipmentStatusSet = new Set<string>(SHIPMENT_STATUSES);
const dutyStatusSet = new Set<string>(HOS_DUTY_STATUSES);
const availabilityKindSet = new Set<string>(AVAILABILITY_KINDS);
const payoutStatusSet = new Set<string>(PAYOUT_STATUSES);
const vehicleStatusSet = new Set<string>(VEHICLE_STATUSES);

export function serializeDemoOperationsState(state: DemoOperationsState): string {
  return JSON.stringify(state);
}

export function deserializeDemoOperationsState(serialized: string): DemoOperationsState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw corruptStateError();
  }

  return migrateDemoOperationsState(parsed);
}

export function migrateDemoOperationsState(value: unknown): DemoOperationsState {
  const migrated = migrateVersionZeroEnvelope(value);
  if (!isDemoOperationsState(migrated)) {
    throw corruptStateError();
  }
  return migrated;
}

export function isDemoOperationsState(value: unknown): value is DemoOperationsState {
  if (!isRecord(value) || value.version !== DEMO_STATE_VERSION || !isIsoDateTime(value.updatedAt)) {
    return false;
  }

  if (!isSession(value.session) || !isRecordArray(value.accounts) || !isRecordArray(value.customers)) {
    return false;
  }

  if (
    !isRecordArray(value.drivers) ||
    !isRecordArray(value.shipments) ||
    !isRecordArray(value.hosClocks) ||
    !isRecordArray(value.exceptions) ||
    !isRecordArray(value.proofsOfDelivery) ||
    !isRecordArray(value.messages) ||
    !isRecordArray(value.ediTransactions) ||
    !isRecordArray(value.requests) ||
    !isRecordArray(value.quotes) ||
    !isRecordArray(value.integrations) ||
    !isRecordArray(value.vehicles) ||
    !isRecordArray(value.availabilityBlocks) ||
    !isRecordArray(value.availabilityRules) ||
    !isRecordArray(value.maintenanceOrders) ||
    !isRecordArray(value.complianceDocuments) ||
    !isRecordArray(value.payouts)
  ) {
    return false;
  }

  if (!value.accounts.every(isAccount) || !value.drivers.every(isDriver)) {
    return false;
  }

  if (!value.shipments.every(isShipment) || !value.hosClocks.every(isHosClock)) {
    return false;
  }

  if (
    !value.vehicles.every(isVehicle) ||
    !value.availabilityBlocks.every(isAvailabilityBlock) ||
    !value.availabilityRules.every(isAvailabilityRule) ||
    !value.maintenanceOrders.every(isMaintenanceOrder) ||
    !value.complianceDocuments.every(isComplianceDocument) ||
    !value.payouts.every(isPayout)
  ) {
    return false;
  }

  if (
    !value.customers.every(hasStringId) ||
    !value.exceptions.every(hasStringId) ||
    !value.proofsOfDelivery.every(hasStringId) ||
    !value.messages.every(hasStringId) ||
    !value.ediTransactions.every(hasStringId) ||
    !value.requests.every(hasStringId) ||
    !value.quotes.every(hasStringId) ||
    !value.integrations.every(hasStringId)
  ) {
    return false;
  }

  return hasValidSessionAccount(value);
}

function migrateVersionZeroEnvelope(value: unknown): unknown {
  if (!isRecord(value) || value.version !== 0 || !isRecord(value.state)) {
    return value;
  }

  return {
    ...value.state,
    version: DEMO_STATE_VERSION,
  };
}

function isSession(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const accountIdIsValid = value.accountId === null || typeof value.accountId === "string";
  const roleIsValid = value.effectiveRole === null || (
    typeof value.effectiveRole === "string" && roleSet.has(value.effectiveRole)
  );
  return accountIdIsValid && roleIsValid;
}

function isAccount(value: Record<string, unknown>): boolean {
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

function isDriver(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.firstName) &&
    isNonEmptyString(value.lastName) &&
    isRecord(value.currentLocation) &&
    isFiniteNumber(value.currentLocation.latitude) &&
    isFiniteNumber(value.currentLocation.longitude)
  );
}

function isShipment(value: Record<string, unknown>): boolean {
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

function isHosClock(value: Record<string, unknown>): boolean {
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

function isVehicle(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.unitNumber) &&
    typeof value.status === "string" &&
    vehicleStatusSet.has(value.status) &&
    isNonNegativeNumber(value.odometerMiles)
  );
}

function isAvailabilityBlock(value: Record<string, unknown>): boolean {
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

function isAvailabilityRule(value: Record<string, unknown>): boolean {
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

function isMaintenanceOrder(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.vehicleId) &&
    isNonEmptyString(value.summary) &&
    isIsoDateTime(value.openedAt)
  );
}

function isComplianceDocument(value: Record<string, unknown>): boolean {
  return (
    hasStringId(value) &&
    isNonEmptyString(value.subjectId) &&
    (value.subjectType === "vehicle" || value.subjectType === "driver") &&
    isIsoDateTime(value.expiresOn)
  );
}

/**
 * Line items carry deductions as negative amounts, so they must sum to
 * `netCents`. A blob whose arithmetic disagrees would render a payout screen
 * that contradicts itself, which is worse than rebuilding from fixtures.
 */
function isPayout(value: Record<string, unknown>): boolean {
  if (
    !hasStringId(value) ||
    !isNonEmptyString(value.driverId) ||
    typeof value.status !== "string" ||
    !payoutStatusSet.has(value.status) ||
    !isFiniteNumber(value.netCents) ||
    !Array.isArray(value.lineItems)
  ) {
    return false;
  }

  let total = 0;
  for (const lineItem of value.lineItems) {
    if (!isRecord(lineItem) || !hasStringId(lineItem) || !isFiniteNumber(lineItem.amountCents)) {
      return false;
    }
    total += lineItem.amountCents;
  }
  return total === value.netCents;
}

function hasValidSessionAccount(state: Record<string, unknown>): boolean {
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

function isRecordArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function hasStringId(value: Record<string, unknown>): boolean {
  return isNonEmptyString(value.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function corruptStateError(): OperationsDomainError {
  return new OperationsDomainError(
    "CORRUPT_PERSISTED_STATE",
    "Saved demo data was invalid and has been restored to the default demo.",
  );
}
