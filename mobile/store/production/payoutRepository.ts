import { OperationsDomainError } from "../../domain/errors";
import type {
  EntityId,
  IsoDateTime,
  Payout,
  PayoutMethod,
  PayoutMethodInput,
  PayoutRail,
} from "../../domain/types";
import { normalizePayoutHandle } from "../payoutMethodStore";
import { encodeId, toDomainNetworkError } from "./errors";
import { ProductionFleetRepository } from "./fleetRepository";

/**
 * Settlements, and the payout handles that receive them.
 *
 * Payout handles never enter `OperationsState`, so those four methods read and
 * write the endpoint directly. The server scopes every one of them to the
 * calling driver; there is no path here that can name another driver's handle.
 */
export class ProductionPayoutRepository extends ProductionFleetRepository {
  async listPayoutMethods(): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>("v1/payout-methods");
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async savePayoutMethod(input: PayoutMethodInput): Promise<PayoutMethod> {
    this.requireIdentity();
    // Validated locally first so an obviously wrong handle never leaves the
    // device, and so the driver gets the same message either repository gives.
    const handle = normalizePayoutHandle(input.rail, input.handle);
    try {
      return await this.apiClient.requestJson<PayoutMethod>("v1/payout-methods", {
        body: { handle, id: input.id ?? null, isDefault: input.isDefault ?? null, label: input.label ?? null, rail: input.rail },
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async removePayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>(
        `v1/payout-methods/${encodeId(methodId)}/removal`,
        { body: {}, idempotencyKey: this.idFactory(), method: "POST" },
      );
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async setDefaultPayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>(
        `v1/payout-methods/${encodeId(methodId)}/default`,
        { body: {}, idempotencyKey: this.idFactory(), method: "POST" },
      );
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async issuePayout(
    driverId: EntityId,
    periodStart: IsoDateTime,
    periodEnd: IsoDateTime,
  ): Promise<Payout> {
    const issued = await this.performMutation<{ readonly id: string }>("v1/payouts", {
      driverId,
      periodEnd,
      periodStart,
    }, ["payouts"]);
    return this.requirePayout(issued.id);
  }

  async markPayoutPaid(payoutId: EntityId, rail: PayoutRail): Promise<Payout> {
    await this.performMutation<{ readonly id: string }>(
      `v1/payouts/${encodeId(payoutId)}/payment`,
      { rail },
      ["payouts"],
    );
    return this.requirePayout(payoutId);
  }

  private requirePayout(payoutId: EntityId): Payout {
    const payout = this.state.payouts.find((candidate) => candidate.id === payoutId);
    if (!payout) {
      throw new OperationsDomainError("NOT_FOUND", "That settlement could not be found.");
    }
    return payout;
  }
}
