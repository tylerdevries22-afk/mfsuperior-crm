import { OperationsDomainError } from "../../domain/errors";
import type {
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilityRule,
  AvailabilityRuleInput,
  DemoOperationsState,
  EntityId,
} from "../../domain/types";
import { encodeId } from "./errors";
import { ProductionMessagingRepository } from "./messagingRepository";

/**
 * Fleet, availability, shop, compliance, and settlement writes start here.
 *
 * Each posts to its versioned endpoint and then re-reads state, so the record
 * returned is the one the server actually holds rather than an optimistic
 * local guess. Role enforcement lives on the server: `authorizeMobileRequest`
 * refuses the call before it reaches a query.
 */
export class ProductionAvailabilityRepository extends ProductionMessagingRepository {
  /**
   * Availability goes through the offline queue rather than posting directly.
   * A driver blocking time does it from the cab, and losing that write to a
   * dead zone would leave dispatch believing they are available. The queue
   * replays it through `v1/mutations` when signal returns.
   */
  async setAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock> {
    const identity = this.requireIdentity();
    const driverId = input.driverId ?? identity.driverId ?? "";
    await this.enqueueAndSync({
      entityId: input.id ?? `availability-${input.startsAt}`,
      entityVersion: 0,
      kind: "availability",
      ownerUserId: identity.userId,
      payload: { block: input },
      shipmentId: `availability-${driverId}`,
    });
    await this.refreshState(["availabilityBlocks"]);

    // The server assigns the id, so a block that has already synced is found by
    // its span. One still sitting in the queue has no server row yet, and is
    // reflected optimistically — the same treatment `transitionShipment` gives
    // a queued status change. Queuing is a success, not a failure to report.
    const synced = this.state.availabilityBlocks.find(
      (block) => block.driverId === driverId &&
        block.startsAt === input.startsAt &&
        block.endsAt === input.endsAt,
    );
    if (synced) {
      return synced;
    }

    const now = this.clock();
    const pending: AvailabilityBlock = {
      createdAt: now,
      driverId,
      endsAt: input.endsAt,
      id: input.id ?? `pending-availability-${Date.parse(input.startsAt)}`,
      kind: input.kind,
      note: input.note,
      startsAt: input.startsAt,
      updatedAt: now,
    };
    this.replaceState({
      ...this.state,
      availabilityBlocks: [
        ...this.state.availabilityBlocks.filter((block) => block.id !== pending.id),
        pending,
      ],
      updatedAt: now,
    });
    return pending;
  }

  async removeAvailabilityBlock(blockId: EntityId): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    await this.enqueueAndSync({
      entityId: blockId,
      entityVersion: 0,
      kind: "availability_removal",
      ownerUserId: identity.userId,
      payload: { blockId },
      shipmentId: `availability-${identity.driverId ?? identity.userId}`,
    });
    // Dropped locally first, so the calendar does not keep showing a block the
    // driver just deleted while the queue drains.
    this.replaceState({
      ...this.state,
      availabilityBlocks: this.state.availabilityBlocks.filter(
        (block) => block.id !== blockId,
      ),
      updatedAt: this.clock(),
    });
    await this.refreshState(["availabilityBlocks"]);
    return this.state;
  }

  async setAvailabilityRule(input: AvailabilityRuleInput): Promise<AvailabilityRule> {
    const saved = await this.performMutation<{ readonly id: string }>(
      "v1/availability-rules",
      {
        driverId: input.driverId ?? null,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        endMinute: input.endMinute,
        id: input.id ?? null,
        kind: input.kind,
        startMinute: input.startMinute,
        weekday: input.weekday,
      },
      ["availabilityRules"],
    );
    const rule = this.state.availabilityRules.find((candidate) => candidate.id === saved.id);
    if (!rule) {
      throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
    }
    return rule;
  }

  async removeAvailabilityRule(ruleId: EntityId): Promise<DemoOperationsState> {
    await this.performMutation<{ readonly id: string }>(
      `v1/availability-rules/${encodeId(ruleId)}/removal`,
      {},
      // Removing a pattern also removes the blocks it expanded into.
      ["availabilityRules", "availabilityBlocks"],
    );
    return this.state;
  }
}
