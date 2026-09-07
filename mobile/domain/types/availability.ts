/**
 * Driver availability calendars.
 *
 * Every timestamp here is a full `IsoDateTime` rather than a calendar date
 * because `anchorDemoStateTo` shifts the demo clock by walking the state for
 * parseable ISO strings. A bare "2026-09-03" would not move, so a document
 * seeded to expire twelve days out would drift further away every day.
 */

import type { EntityId, IsoDateTime } from "./core";

export const AVAILABILITY_KINDS = [
  "available",
  "unavailable",
  "time_off",
  "preferred",
] as const;

export type AvailabilityKind = (typeof AVAILABILITY_KINDS)[number];

/** A concrete span on one driver's calendar. */
export interface AvailabilityBlock {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly kind: AvailabilityKind;
  readonly note?: string;
  /** Set when the block was expanded from a recurring rule. */
  readonly ruleId?: EntityId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/**
 * A repeating weekly pattern. Minutes are local to the driver's schedule
 * timezone and measured from midnight, so a rule survives a DST boundary that
 * a stored wall-clock timestamp would not.
 */
export interface AvailabilityRule {
  readonly id: EntityId;
  readonly driverId: EntityId;
  /** 0 is Sunday, matching `Date.prototype.getDay`. */
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly kind: AvailabilityKind;
  readonly effectiveFrom: IsoDateTime;
  readonly effectiveUntil?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface AvailabilityBlockInput {
  /** Admins may write any driver's calendar; drivers may only write their own. */
  readonly driverId?: EntityId;
  /** Omitted when creating; supplied to replace an existing block in place. */
  readonly id?: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly kind: AvailabilityKind;
  readonly note?: string;
}

export interface AvailabilityRuleInput {
  readonly driverId?: EntityId;
  readonly id?: EntityId;
  readonly weekday: AvailabilityRule["weekday"];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly kind: AvailabilityKind;
  readonly effectiveFrom: IsoDateTime;
  readonly effectiveUntil?: IsoDateTime;
}
