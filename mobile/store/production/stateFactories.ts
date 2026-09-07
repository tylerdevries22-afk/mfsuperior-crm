import { OperationsDomainError } from "../../domain/errors";
import type { DemoOperationsState, GeoPoint, HosDutyStatus } from "../../domain/types";
import { DEMO_STATE_VERSION } from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import { isDemoOperationsState } from "../stateSchema";

export function requireProductionState(
  state: DemoOperationsState,
  identity: AuthIdentity | null,
): DemoOperationsState {
  if (!isDemoOperationsState(state) || state.accounts.some((account) => account.demoPin !== undefined)) {
    throw new OperationsDomainError("VALIDATION_FAILED", "The operations service returned invalid data.");
  }
  const account = state.accounts.find(({ id }) => id === state.session.accountId);
  if (!identity || account?.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) {
    throw new OperationsDomainError("UNAUTHORIZED", "The operations membership does not match this session.");
  }
  return state;
}

export function createEmptyOperationsState(updatedAt: string): DemoOperationsState {
  return {
    accounts: [],
    availabilityBlocks: [],
    availabilityRules: [],
    driverShifts: [],
    shiftCoverageRequests: [],
    scheduleSyncStatuses: [],
    complianceDocuments: [],
    customers: [],
    drivers: [],
    ediTransactions: [],
    exceptions: [],
    hosClocks: [],
    integrations: [],
    maintenanceOrders: [],
    messages: [],
    payouts: [],
    proofsOfDelivery: [],
    quotes: [],
    requests: [],
    session: { accountId: null, effectiveRole: null },
    shipments: [],
    updatedAt,
    vehicles: [],
    version: DEMO_STATE_VERSION,
  };
}

export function updateDutyStatus(
  state: DemoOperationsState,
  driverId: string,
  status: HosDutyStatus,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    hosClocks: state.hosClocks.map((clock) => clock.driverId === driverId
      ? { ...clock, status, statusStartedAt: occurredAt }
      : clock),
    updatedAt: occurredAt,
  };
}

export function updateDriverLocation(
  state: DemoOperationsState,
  driverId: string,
  coordinates: GeoPoint,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    drivers: state.drivers.map((driver) => driver.id === driverId
      ? { ...driver, currentLocation: coordinates, locationUpdatedAt: occurredAt }
      : driver),
    updatedAt: occurredAt,
  };
}
