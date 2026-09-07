import { OperationsDomainError } from "../../domain/errors";
import type {
  DemoOperationsState,
  DriverShift,
  DriverShiftInput,
  EntityId,
  ScheduleSyncStatus,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
} from "../../domain/types";
import { ProductionAvailabilityRepository } from "./availabilityRepository";
import { encodeId } from "./errors";

/** Rostered shifts, coverage handoffs, and the calendar sync each one drives. */
export class ProductionShiftRepository extends ProductionAvailabilityRepository {
  async setDriverShift(input: DriverShiftInput): Promise<DriverShift> {
    const saved = await this.performMutation<{ readonly id: string }>(
      "v1/shifts",
      {
        driverId: input.driverId,
        endsAt: input.endsAt,
        id: input.id ?? null,
        note: input.note ?? null,
        startsAt: input.startsAt,
        status: input.status ?? "scheduled",
      },
      ["driverShifts", "scheduleSyncStatuses"],
    );
    return this.requireDriverShift(saved.id);
  }

  async removeDriverShift(shiftId: EntityId): Promise<DemoOperationsState> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(shiftId)}/removal`,
      {},
      ["driverShifts", "shiftCoverageRequests", "scheduleSyncStatuses"],
    );
    return this.state;
  }

  async requestShiftCoverage(input: ShiftCoverageRequestInput): Promise<ShiftCoverageRequest> {
    const created = await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(input.shiftId)}/coverage`,
      { targetDriverId: input.targetDriverId },
      ["shiftCoverageRequests"],
    );
    return this.requireCoverageRequest(created.id);
  }

  async respondToShiftCoverage(
    requestId: EntityId,
    response: "accepted" | "declined",
  ): Promise<ShiftCoverageRequest> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shift-coverage/${encodeId(requestId)}/response`,
      { response },
      ["driverShifts", "shiftCoverageRequests", "scheduleSyncStatuses"],
    );
    return this.requireCoverageRequest(requestId);
  }

  async retryScheduleSync(shiftId: EntityId): Promise<ScheduleSyncStatus> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(shiftId)}/sync-retry`,
      {},
      ["scheduleSyncStatuses"],
    );
    return this.requireScheduleSync(shiftId);
  }

  private requireDriverShift(shiftId: EntityId): DriverShift {
    const shift = this.state.driverShifts.find((candidate) => candidate.id === shiftId);
    if (!shift) {
      throw new OperationsDomainError("NOT_FOUND", "That driver shift could not be found.");
    }
    return shift;
  }

  private requireCoverageRequest(requestId: EntityId): ShiftCoverageRequest {
    const request = this.state.shiftCoverageRequests.find((candidate) => candidate.id === requestId);
    if (!request) {
      throw new OperationsDomainError("NOT_FOUND", "That coverage request could not be found.");
    }
    return request;
  }

  private requireScheduleSync(shiftId: EntityId): ScheduleSyncStatus {
    const status = this.state.scheduleSyncStatuses.find((candidate) => candidate.entityId === shiftId);
    if (!status) {
      throw new OperationsDomainError("NOT_FOUND", "That schedule sync status could not be found.");
    }
    return status;
  }
}
