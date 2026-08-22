import type {
  EntityId,
  IsoDateTime,
  Payout,
  PayoutLineItem,
  Shipment,
} from "./types";

/**
 * Settlement math.
 *
 * Kept pure and separate from the repository so the payout screens and the
 * repository agree on every figure by construction rather than by two
 * implementations happening to match.
 */

/** Percentage pay: the share of a load's linehaul that reaches the driver. */
export const DRIVER_LINEHAUL_SHARE = 0.72;

/** Flat per-settlement deduction, carried as a negative line item. */
export const OCCUPATIONAL_INSURANCE_CENTS = 6_240;

export interface PayoutTotals {
  readonly grossCents: number;
  readonly deductionCents: number;
  readonly netCents: number;
}

/**
 * Positive line items are earnings and negative ones are deductions, so the
 * items always sum to net. Every screen that shows a total reads this.
 */
export function summarizePayout(lineItems: readonly PayoutLineItem[]): PayoutTotals {
  let grossCents = 0;
  let deductionCents = 0;
  for (const lineItem of lineItems) {
    if (lineItem.amountCents >= 0) {
      grossCents += lineItem.amountCents;
    } else {
      deductionCents -= lineItem.amountCents;
    }
  }
  return { deductionCents, grossCents, netCents: grossCents - deductionCents };
}

/** Delivered loads for one driver whose delivery falls inside the period. */
export function shipmentsInPeriod(
  shipments: readonly Shipment[],
  driverId: EntityId,
  periodStart: IsoDateTime,
  periodEnd: IsoDateTime,
): readonly Shipment[] {
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  return shipments
    .filter((shipment) => shipment.assignedDriverId === driverId && shipment.status === "delivered")
    .filter((shipment) => {
      const deliveredAt = deliveryTime(shipment);
      return deliveredAt !== null && deliveredAt >= start && deliveredAt <= end;
    })
    .sort((left, right) => (deliveryTime(left) ?? 0) - (deliveryTime(right) ?? 0));
}

/**
 * The moment a load was actually delivered — the completion stamp on its final
 * stop, falling back to the delivered event. A load with neither has not been
 * delivered in a way a settlement can stand on, so it is excluded.
 */
export function deliveryTime(shipment: Shipment): number | null {
  const finalStop = [...shipment.stops].sort((left, right) => right.sequence - left.sequence)[0];
  if (finalStop?.completedAt) {
    return Date.parse(finalStop.completedAt);
  }
  const delivered = shipment.events.find((event) => event.type === "delivered");
  return delivered ? Date.parse(delivered.occurredAt) : null;
}

export interface PayoutDraftOptions {
  readonly driverId: EntityId;
  readonly periodStart: IsoDateTime;
  readonly periodEnd: IsoDateTime;
  readonly shipments: readonly Shipment[];
  readonly nextId: (prefix: string) => string;
}

/**
 * Build the line items a settlement period earns. Accessorials ride along with
 * their load rather than being rolled into linehaul so a driver can see which
 * stop the extra money came from.
 */
export function buildPayoutLineItems(options: PayoutDraftOptions): readonly PayoutLineItem[] {
  const earned = shipmentsInPeriod(
    options.shipments,
    options.driverId,
    options.periodStart,
    options.periodEnd,
  );

  const lineItems: PayoutLineItem[] = [];
  for (const shipment of earned) {
    lineItems.push({
      amountCents: Math.round(shipment.charges.linehaulCents * DRIVER_LINEHAUL_SHARE),
      description: `${shipment.loadNumber} · ${routeLabel(shipment)} · ${shipment.distanceMiles.toLocaleString()} mi`,
      id: options.nextId("payout-line"),
      kind: "linehaul",
      shipmentId: shipment.id,
    });
    if (shipment.charges.accessorialsCents > 0) {
      lineItems.push({
        amountCents: shipment.charges.accessorialsCents,
        description: `${shipment.loadNumber} · Accessorials`,
        id: options.nextId("payout-line"),
        kind: "accessorial",
        shipmentId: shipment.id,
      });
    }
  }

  // A period that earned nothing carries no deduction either; billing a driver
  // for a week they did not work would be a bug, not a policy.
  if (lineItems.length > 0) {
    lineItems.push({
      amountCents: -OCCUPATIONAL_INSURANCE_CENTS,
      description: "Occupational accident coverage",
      id: options.nextId("payout-line"),
      kind: "deduction",
    });
  }
  return lineItems;
}

/** Earnings a driver has accrued across every settlement issued to them. */
export function lifetimeEarningsCents(payouts: readonly Payout[]): number {
  return payouts.reduce((total, payout) => total + payout.netCents, 0);
}

function routeLabel(shipment: Shipment): string {
  const ordered = [...shipment.stops].sort((left, right) => left.sequence - right.sequence);
  const origin = ordered[0]?.address.city ?? "Origin";
  const destination = ordered[ordered.length - 1]?.address.city ?? "Destination";
  return `${origin} to ${destination}`;
}
