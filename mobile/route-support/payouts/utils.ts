import { shipmentsInPeriod } from "@/domain/payouts";
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

/** How far back to look before giving up and offering the last closed week. */
const MAX_WEEKS_BACK = 12;

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
 * The most recent week with at least one driver owed something, walking back
 * from the week the clock is in. Falls back to the last closed week so the
 * console always has a period to name, even with nothing to settle.
 */
export function nextSettlementPeriod(
  shipments: readonly Shipment[],
  payouts: readonly Payout[],
  driverIds: readonly string[],
  now: Date = new Date(),
): SettlementPeriod {
  const current = weekContaining(now);

  for (let back = 0; back < MAX_WEEKS_BACK; back += 1) {
    const period = shiftWeeks(current, -back);
    const hasWork = driverIds.some((driverId) => {
      if (isPeriodSettled(payouts, driverId, period)) {
        return false;
      }
      return shipmentsInPeriod(shipments, driverId, period.start, period.end).length > 0;
    });
    if (hasWork) {
      return period;
    }
  }

  return shiftWeeks(current, -1);
}

export function formatSettlementPeriod(period: SettlementPeriod): string {
  const start = new Date(period.start);
  // The window is exclusive at the end, so name the last day inside it.
  const end = new Date(Date.parse(period.end) - 86_400_000);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-US", { day: "numeric", month: sameMonth ? undefined : "short" })}`;
}
