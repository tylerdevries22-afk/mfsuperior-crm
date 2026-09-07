/**
 * Persistence schema for the demo operations state.
 *
 * Serialization, migration, and the top-level shape check live here; the
 * per-entity guards they compose are grouped under `./schema/`.
 */
import { OperationsDomainError } from "../domain/errors";
import { DEMO_STATE_VERSION, type DemoOperationsState } from "../domain/types";
import {
  hasValidSessionAccount,
  isAccount,
  isDriver,
  isHosClock,
  isSession,
  isShipment,
} from "./schema/coreGuards";
import {
  isComplianceDocument,
  isMaintenanceOrder,
  isPayout,
  isVehicle,
} from "./schema/fleetGuards";
import {
  hasStringId,
  isIsoDateTime,
  isRecord,
  isRecordArray,
} from "./schema/primitives";
import {
  isAvailabilityBlock,
  isAvailabilityRule,
  isDriverShift,
  isScheduleSyncStatus,
  isShiftCoverageRequest,
} from "./schema/scheduleGuards";

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

  if (
    !isSession(value.session) ||
    !isRecordArray(value.accounts) ||
    !isRecordArray(value.customers)
  ) {
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
    !isRecordArray(value.driverShifts) ||
    !isRecordArray(value.shiftCoverageRequests) ||
    !isRecordArray(value.scheduleSyncStatuses) ||
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
    !value.driverShifts.every(isDriverShift) ||
    !value.shiftCoverageRequests.every(isShiftCoverageRequest) ||
    !value.scheduleSyncStatuses.every(isScheduleSyncStatus) ||
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

function corruptStateError(): OperationsDomainError {
  return new OperationsDomainError(
    "CORRUPT_PERSISTED_STATE",
    "Saved demo data was invalid and has been restored to the default demo.",
  );
}
