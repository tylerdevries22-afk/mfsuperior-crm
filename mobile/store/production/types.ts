import type {
  AvailabilityBlock,
  AvailabilityRule,
  ComplianceDocument,
  DriverShift,
  MaintenanceOrder,
  Payout,
  ScheduleSyncStatus,
  ShiftCoverageRequest,
  Vehicle,
} from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import type { ApiClient } from "../../lib/network";
import type { OfflineMutationQueue, OfflineQueueHooks } from "../../lib/offline";

export interface ProductionAuthGateway {
  getCurrentIdentity(): Promise<AuthIdentity | null>;
  signIn(email: string, password: string): Promise<AuthIdentity>;
  signOut(): Promise<void>;
}

export interface ProductionOperationsRepositoryOptions {
  readonly apiClient: ApiClient;
  readonly auth: ProductionAuthGateway;
  readonly clock?: () => string;
  readonly fetchImplementation?: typeof fetch;
  readonly idFactory?: () => string;
  readonly offlineQueue: OfflineMutationQueue;
  readonly queueHooks?: OfflineQueueHooks;
  readonly uploadBaseUrl?: string;
}

/** The collections a mutation may ask `refreshState` to re-read. */
export interface ExtendedCollections {
  readonly availabilityBlocks: readonly AvailabilityBlock[];
  readonly availabilityRules: readonly AvailabilityRule[];
  readonly driverShifts: readonly DriverShift[];
  readonly shiftCoverageRequests: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses: readonly ScheduleSyncStatus[];
  readonly complianceDocuments: readonly ComplianceDocument[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly payouts: readonly Payout[];
  readonly vehicles: readonly Vehicle[];
}

export type ExtendedRefresh = "all" | "cached" | readonly (keyof ExtendedCollections)[];

export const EMPTY_EXTENDED: ExtendedCollections = {
  availabilityBlocks: [],
  availabilityRules: [],
  driverShifts: [],
  shiftCoverageRequests: [],
  scheduleSyncStatuses: [],
  complianceDocuments: [],
  maintenanceOrders: [],
  payouts: [],
  vehicles: [],
};
