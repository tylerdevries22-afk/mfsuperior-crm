import { OperationsDomainError } from "../../domain/errors";
import { buildPayoutLineItems, summarizePayout } from "../../domain/payouts";
import type { EntityId, IsoDateTime, Payout, PayoutRail } from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { findDriver } from "./lookups";
import { normalizedIsoDateTime } from "./validation";

export function issuePayout(
  { state, occurredAt, nextId }: DemoWriteContext,
  driverId: EntityId,
  periodStart: IsoDateTime,
  periodEnd: IsoDateTime,
): StateUpdate<Payout> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to issue a settlement.",
  );
  findDriver(state, driverId);
  const start = normalizedIsoDateTime(periodStart);
  const end = normalizedIsoDateTime(periodEnd);
  if (Date.parse(end) <= Date.parse(start)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "A settlement period has to end after it starts.",
    );
  }

  // Two settlements covering one delivery would pay for it twice.
  const overlapping = state.payouts.find(
    (candidate) => candidate.driverId === driverId &&
      candidate.status !== "failed" &&
      Date.parse(candidate.periodStart) < Date.parse(end) &&
      Date.parse(candidate.periodEnd) > Date.parse(start),
  );
  if (overlapping) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "That period overlaps a settlement this driver already has.",
    );
  }

  const lineItems = buildPayoutLineItems({
    driverId,
    nextId,
    periodEnd: end,
    periodStart: start,
    shipments: state.shipments,
  });
  if (lineItems.length === 0) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "That period has no delivered loads to settle.",
    );
  }

  const totals = summarizePayout(lineItems);
  const payout: Payout = {
    createdAt: occurredAt,
    deductionCents: totals.deductionCents,
    driverId,
    grossCents: totals.grossCents,
    id: nextId("payout"),
    issuedAt: occurredAt,
    lineItems,
    netCents: totals.netCents,
    periodEnd: end,
    periodStart: start,
    status: "pending",
    updatedAt: occurredAt,
  };

  return {
    result: payout,
    state: { ...state, payouts: [...state.payouts, payout], updatedAt: occurredAt },
  };
}

/**
 * Records that a settlement was paid on a rail. This moves no money and
 * contacts nothing; it is the ledger catching up with a transfer that
 * happened in the driver's own payment app.
 */
export function markPayoutPaid(
  { state, occurredAt }: DemoWriteContext,
  payoutId: EntityId,
  rail: PayoutRail,
): StateUpdate<Payout> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to record a settlement as paid.",
  );
  const payout = state.payouts.find((candidate) => candidate.id === payoutId);
  if (!payout) {
    throw new OperationsDomainError("NOT_FOUND", "That settlement could not be found.");
  }
  if (payout.status === "paid") {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "That settlement is already recorded as paid.",
    );
  }

  const updated: Payout = {
    ...payout,
    paidAt: occurredAt,
    // The rail, never the handle. An admin reconciling a settlement needs
    // to know it went out over Venmo; they have no business knowing which
    // Venmo account, and no read path to one.
    rail,
    status: "paid",
    updatedAt: occurredAt,
  };
  return {
    result: updated,
    state: {
      ...state,
      payouts: state.payouts.map((candidate) => candidate.id === updated.id ? updated : candidate),
      updatedAt: occurredAt,
    },
  };
}
