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
import type { ApiClient } from "../../lib/network";
import { EMPTY_EXTENDED, type ExtendedCollections, type ExtendedRefresh } from "./types";

/**
 * Fleet, calendar, shop, compliance, and settlement collections.
 *
 * These are refetched only when the caller says a write touched them.
 * `refreshState` runs after every mutation, and re-reading six endpoints each
 * time a driver advances a stop would put five useless round-trips on a
 * connection that is often a phone in a moving truck. Everything not
 * refetched is served from the copy the last read produced.
 */
export class ExtendedCollectionLoader {
  private readonly apiClient: ApiClient;
  private cached: ExtendedCollections = EMPTY_EXTENDED;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Each collection is fetched only for the roles allowed to read it, and each
   * one is tolerated individually: a server that has not deployed these
   * endpoints yet, or an endpoint that is briefly failing, leaves its screen
   * empty rather than taking the whole session down with it.
   */
  async load(
    isAdmin: boolean,
    isStaff: boolean,
    refresh: ExtendedRefresh,
  ): Promise<ExtendedCollections> {
    const wanted = (key: keyof ExtendedCollections): boolean => (
      refresh === "all" || (Array.isArray(refresh) && refresh.includes(key))
    );
    const cached = this.cached;

    const [
      availabilityBlocks,
      availabilityRules,
      driverShifts,
      shiftCoverageRequests,
      scheduleSyncStatuses,
      vehicles,
      maintenanceOrders,
      complianceDocuments,
      payouts,
    ] = await Promise.all([
      isStaff && wanted("availabilityBlocks")
        ? this.optionalCollection<AvailabilityBlock>("v1/availability?limit=200")
        : cached.availabilityBlocks,
      isStaff && wanted("availabilityRules")
        ? this.optionalCollection<AvailabilityRule>("v1/availability-rules?limit=200")
        : cached.availabilityRules,
      isStaff && wanted("driverShifts")
        ? this.optionalCollection<DriverShift>("v1/shifts?limit=500")
        : cached.driverShifts,
      isStaff && wanted("shiftCoverageRequests")
        ? this.optionalCollection<ShiftCoverageRequest>("v1/shift-coverage?limit=200")
        : cached.shiftCoverageRequests,
      isStaff && wanted("scheduleSyncStatuses")
        ? this.optionalCollection<ScheduleSyncStatus>("v1/schedule-sync?limit=500")
        : cached.scheduleSyncStatuses,
      isAdmin && wanted("vehicles")
        ? this.optionalCollection<Vehicle>("v1/vehicles?limit=100")
        : cached.vehicles,
      isAdmin && wanted("maintenanceOrders")
        ? this.optionalCollection<MaintenanceOrder>("v1/maintenance?limit=100")
        : cached.maintenanceOrders,
      isAdmin && wanted("complianceDocuments")
        ? this.optionalCollection<ComplianceDocument>("v1/compliance?limit=200")
        : cached.complianceDocuments,
      isStaff && wanted("payouts")
        ? this.optionalCollection<Payout>("v1/payouts?limit=100")
        : cached.payouts,
    ]);

    this.cached = {
      availabilityBlocks,
      availabilityRules,
      driverShifts,
      shiftCoverageRequests,
      scheduleSyncStatuses,
      complianceDocuments,
      maintenanceOrders,
      payouts,
      vehicles,
    };
    return this.cached;
  }

  /**
   * A collection whose absence is survivable. Returns an empty list rather than
   * throwing, so one unavailable endpoint cannot block sign-in.
   *
   * The shape is checked as well as the call: an endpoint that answers with
   * something other than a list would otherwise put a non-array straight into
   * state, where it fails validation and takes the whole session down — the
   * exact outcome this is meant to avoid.
   */
  private async optionalCollection<Row>(path: string): Promise<readonly Row[]> {
    try {
      const rows = await this.apiClient.requestJson<readonly Row[]>(path);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
}
