import type { OperationsRepository } from "../domain/repository";
import { ProductionPayoutRepository } from "./production/payoutRepository";

export type {
  ProductionAuthGateway,
  ProductionOperationsRepositoryOptions,
} from "./production/types";

/**
 * The repository the app talks to when it is pointed at the real backend.
 *
 * Its surface is assembled from one chain of focused links under
 * `./production`, each adding a single domain area to the one before it:
 *
 *   repositoryBase        session state, offline queue, the two write paths
 *   shipmentRepository    tenders, dispatch, status transitions, telemetry
 *   exceptionRepository   exception reports and proofs of delivery
 *   messagingRepository   operations messages and customer freight requests
 *   availabilityRepository driver availability blocks and weekly patterns
 *   shiftRepository       rostered shifts, coverage, calendar sync
 *   fleetRepository       vehicles, work orders, compliance documents
 *   payoutRepository      settlements and payout handles
 *
 * `implements OperationsRepository` is declared here rather than on a link so
 * the contract is checked against the assembled surface, which is the only
 * thing callers ever hold.
 */
export class ProductionOperationsRepository
  extends ProductionPayoutRepository
  implements OperationsRepository {}
