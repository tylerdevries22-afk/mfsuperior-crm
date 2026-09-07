import type { AvailabilityBlock, AvailabilityRule } from "./availability";
import type { ComplianceDocument } from "./compliance";
import type { IsoDateTime, OperationsAccount, OperationsSession } from "./core";
import type { Customer, CustomerRequest, FreightQuote } from "./customers";
import type { Driver, HosClock } from "./drivers";
import type { EdiTransaction, IntegrationHealth } from "./edi";
import type { ExceptionReport, ProofOfDelivery } from "./exceptions";
import type { Vehicle } from "./fleet";
import type { MaintenanceOrder } from "./maintenance";
import type { OperationsMessage } from "./messaging";
import type { Payout } from "./payouts";
import type { DriverShift, ScheduleSyncStatus, ShiftCoverageRequest } from "./shifts";
import type { Shipment } from "./shipments";

/**
 * Bumped to 4 when the seeded settlement periods moved onto the two weeks
 * before the fixture clock.
 *
 * The lesson of that change: the version guards fixture *content*, not just
 * the state's shape. Moving the payout periods without bumping it left every
 * device that already held v3 state reusing the old periods, which covered the
 * one delivered load and made settlements permanently unissuable — a bug no
 * amount of fixing the fixtures could reach, because the fixtures were never
 * read again. Bump this whenever seeded data changes in a way a screen reads.
 */
export const DEMO_STATE_VERSION = 5 as const;

export interface OperationsState {
  readonly version: typeof DEMO_STATE_VERSION;
  readonly session: OperationsSession;
  readonly accounts: readonly OperationsAccount[];
  readonly customers: readonly Customer[];
  readonly drivers: readonly Driver[];
  readonly shipments: readonly Shipment[];
  readonly hosClocks: readonly HosClock[];
  readonly exceptions: readonly ExceptionReport[];
  readonly proofsOfDelivery: readonly ProofOfDelivery[];
  readonly messages: readonly OperationsMessage[];
  readonly ediTransactions: readonly EdiTransaction[];
  readonly requests: readonly CustomerRequest[];
  readonly quotes: readonly FreightQuote[];
  readonly integrations: readonly IntegrationHealth[];
  readonly vehicles: readonly Vehicle[];
  readonly availabilityBlocks: readonly AvailabilityBlock[];
  readonly availabilityRules: readonly AvailabilityRule[];
  readonly driverShifts: readonly DriverShift[];
  readonly shiftCoverageRequests: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses: readonly ScheduleSyncStatus[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly complianceDocuments: readonly ComplianceDocument[];
  readonly payouts: readonly Payout[];
  readonly updatedAt: IsoDateTime;
}

export type DemoOperationsState = OperationsState;
