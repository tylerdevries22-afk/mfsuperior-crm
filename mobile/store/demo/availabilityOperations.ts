import { OperationsDomainError } from "../../domain/errors";
import type {
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilityRule,
  AvailabilityRuleInput,
  DemoOperationsState,
  EntityId,
} from "../../domain/types";
import {
  getSessionContext,
  resolveAvailabilityDriverId,
  type DemoWriteContext,
  type StateUpdate,
} from "./context";
import { normalizedIsoDateTime } from "./validation";

/**
 * Availability writes. A driver owns their own calendar; an admin may write
 * anyone's by naming a driver in the input. Conflicts with already-assigned
 * loads are surfaced by the screen, which has both collections in hand —
 * the write itself is never blocked, because a driver telling dispatch they
 * are unavailable is information dispatch needs, not an error.
 */
export function setAvailabilityBlock(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: AvailabilityBlockInput,
): StateUpdate<AvailabilityBlock> {
  const context = getSessionContext(state);
  const driverId = resolveAvailabilityDriverId(state, context, input.driverId);
  const startsAt = normalizedIsoDateTime(input.startsAt);
  const endsAt = normalizedIsoDateTime(input.endsAt);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "An availability block has to end after it starts.",
    );
  }

  const existing = input.id
    ? state.availabilityBlocks.find(
        (candidate) => candidate.id === input.id && candidate.driverId === driverId,
      )
    : undefined;
  if (input.id && !existing) {
    throw new OperationsDomainError("NOT_FOUND", "That availability block could not be found.");
  }

  const block: AvailabilityBlock = {
    createdAt: existing?.createdAt ?? occurredAt,
    driverId,
    endsAt,
    id: existing?.id ?? nextId("availability"),
    kind: input.kind,
    note: input.note?.trim() || undefined,
    ruleId: existing?.ruleId,
    startsAt,
    updatedAt: occurredAt,
  };

  const others = state.availabilityBlocks.filter((candidate) => candidate.id !== block.id);
  return {
    result: block,
    state: {
      ...state,
      availabilityBlocks: [...others, block],
      updatedAt: occurredAt,
    },
  };
}

export function removeAvailabilityBlock(
  { state, occurredAt }: DemoWriteContext,
  blockId: EntityId,
): StateUpdate<DemoOperationsState> {
  const context = getSessionContext(state);
  const block = state.availabilityBlocks.find((candidate) => candidate.id === blockId);
  if (!block) {
    throw new OperationsDomainError("NOT_FOUND", "That availability block could not be found.");
  }
  resolveAvailabilityDriverId(state, context, block.driverId);

  const nextState: DemoOperationsState = {
    ...state,
    availabilityBlocks: state.availabilityBlocks.filter(
      (candidate) => candidate.id !== blockId,
    ),
    updatedAt: occurredAt,
  };
  return { result: nextState, state: nextState };
}

export function setAvailabilityRule(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: AvailabilityRuleInput,
): StateUpdate<AvailabilityRule> {
  const context = getSessionContext(state);
  const driverId = resolveAvailabilityDriverId(state, context, input.driverId);
  if (
    !Number.isInteger(input.startMinute) ||
    !Number.isInteger(input.endMinute) ||
    input.startMinute < 0 ||
    input.endMinute > 1_440 ||
    input.endMinute <= input.startMinute
  ) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "A weekly pattern has to cover a real span inside one day.",
    );
  }

  const existing = input.id
    ? state.availabilityRules.find(
        (candidate) => candidate.id === input.id && candidate.driverId === driverId,
      )
    : undefined;
  if (input.id && !existing) {
    throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
  }

  const rule: AvailabilityRule = {
    createdAt: existing?.createdAt ?? occurredAt,
    driverId,
    effectiveFrom: normalizedIsoDateTime(input.effectiveFrom),
    effectiveUntil: input.effectiveUntil
      ? normalizedIsoDateTime(input.effectiveUntil)
      : undefined,
    endMinute: input.endMinute,
    id: existing?.id ?? nextId("availability-rule"),
    kind: input.kind,
    startMinute: input.startMinute,
    updatedAt: occurredAt,
    weekday: input.weekday,
  };

  const others = state.availabilityRules.filter((candidate) => candidate.id !== rule.id);
  return {
    result: rule,
    state: { ...state, availabilityRules: [...others, rule], updatedAt: occurredAt },
  };
}

export function removeAvailabilityRule(
  { state, occurredAt }: DemoWriteContext,
  ruleId: EntityId,
): StateUpdate<DemoOperationsState> {
  const context = getSessionContext(state);
  const rule = state.availabilityRules.find((candidate) => candidate.id === ruleId);
  if (!rule) {
    throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
  }
  resolveAvailabilityDriverId(state, context, rule.driverId);

  const nextState: DemoOperationsState = {
    ...state,
    // Blocks expanded from the rule go with it; leaving them behind would
    // keep enforcing a pattern the driver just deleted.
    availabilityBlocks: state.availabilityBlocks.filter(
      (candidate) => candidate.ruleId !== ruleId,
    ),
    availabilityRules: state.availabilityRules.filter((candidate) => candidate.id !== ruleId),
    updatedAt: occurredAt,
  };
  return { result: nextState, state: nextState };
}
