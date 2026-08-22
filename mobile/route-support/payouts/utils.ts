import { deliveryTime } from "@/domain/payouts";
import type { Payout, Shipment } from "@/domain/types";

/**
 * Choosing which week to settle.
 *
 * Settling "last week" unconditionally is wrong whenever deliveries land in a
 * week that is still open, or whenever last week was already settled — both of
 * which leave the admin staring at a sheet full of zeroes with no explanation.
 * Instead the console walks back from the current week and offers the most
 * recent one that actually has unsettled delivered loads in it.
 */

export interface SettlementPeriod {
  readonly start: string;
  readonly end: string;
}

/** A settlement covers seven days, running on from the one before it. */
const PERIOD_MS = 7 * 86_400_000;

/** The Sunday-aligned week containing `date`, as an instant pair. */
export function weekContaining(date: Date): SettlementPeriod {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  const nextSunday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 7);
  return { end: nextSunday.toISOString(), start: sunday.toISOString() };
}

export function shiftWeeks(period: SettlementPeriod, weeks: number): SettlementPeriod {
  const start = new Date(period.start);
  return weekContaining(
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7),
  );
}

/** Whether a non-failed settlement already covers any part of this period. */
export function isPeriodSettled(
  payouts: readonly Payout[],
  driverId: string,
  period: SettlementPeriod,
): boolean {
  return payouts.some(
    (payout) => payout.driverId === driverId &&
      payout.status !== "failed" &&
      Date.parse(payout.periodStart) < Date.parse(period.end) &&
      Date.parse(payout.periodEnd) > Date.parse(period.start),
  );
}

/**
 * The next period to settle for one driver, or null when they are square.
 *
 * Periods run on from where the previous one ended rather than snapping to the
 * calendar. That is how settlement actually works — a week of driving is the
 * week since the last cheque — and it is also the only formulation that cannot
 * break: a calendar-locked proposal has to overlap any settlement whose own
 * boundaries have moved, and in a demo whose clock shifts by whole days they
 * always have. Proposing contiguously makes alignment irrelevant.
 */
export function nextPeriodForDriver(
  shipments: readonly Shipment[],
  payouts: readonly Payout[],
  driverId: string,
  now: Date = new Date(),
): SettlementPeriod | null {
  const settled = payouts.filter(
    (payout) => payout.driverId === driverId && payout.status !== "failed",
  );

  const covered = (deliveredAt: number): boolean => settled.some(
    (payout) => deliveredAt >= Date.parse(payout.periodStart) &&
      deliveredAt <= Date.parse(payout.periodEnd),
  );

  const owed = shipments
    .filter((shipment) => shipment.assignedDriverId === driverId && shipment.status === "delivered")
    .map((shipment) => deliveryTime(shipment))
    .filter((deliveredAt): deliveredAt is number => deliveredAt !== null)
    .filter((deliveredAt) => !covered(deliveredAt))
    .sort((left, right) => left - right);

  if (owed.length === 0) {
    return null;
  }

  const earliest = owed[0];
  const lastEnd = settled.length === 0
    ? null
    : Math.max(...settled.map((payout) => Date.parse(payout.periodEnd)));

  // Run on from the last settlement when the gap is ahead of it; otherwise the
  // delivery predates every settlement and gets its own calendar week.
  let start = lastEnd !== null && lastEnd <= earliest
    ? lastEnd
    : Date.parse(weekContaining(new Date(earliest)).start);

  // March forward until the window actually contains the delivery, so a driver
  // who was away for a month is not offered an empty period they cannot settle.
  let guard = 0;
  while (earliest >= start + PERIOD_MS && guard < 520) {
    start += PERIOD_MS;
    guard += 1;
  }

  return { end: new Date(start + PERIOD_MS).toISOString(), start: new Date(start).toISOString() };
}

/**
 * The period the console names in its header: the earliest any driver is owed.
 * Each row still settles its own, so this is a label, not the thing acted on.
 */
export function earliestOpenPeriod(
  shipments: readonly Shipment[],
  payouts: readonly Payout[],
  driverIds: readonly string[],
  now: Date = new Date(),
): SettlementPeriod | null {
  const periods = driverIds
    .map((driverId) => nextPeriodForDriver(shipments, payouts, driverId, now))
    .filter((period): period is SettlementPeriod => period !== null)
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
  return periods[0] ?? null;
}

export function formatSettlementPeriod(period: SettlementPeriod): string {
  const start = new Date(period.start);
  // The window is exclusive at the end, so name the last day inside it.
  const end = new Date(Date.parse(period.end) - 86_400_000);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-US", { day: "numeric", month: sameMonth ? undefined : "short" })}`;
}
