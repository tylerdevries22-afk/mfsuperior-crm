import { useMemo } from "react";

import { buildPayoutLineItems, summarizePayout } from "@/domain/payouts";
import type { Driver, Payout, PayoutLineItem, Shipment } from "@/domain/types";
import { nextPeriodForDriver, type SettlementPeriod } from "@/route-support/payouts/utils";

export interface IssueDraft {
  readonly driver: Driver;
  readonly lineItems: readonly PayoutLineItem[];
  readonly period: SettlementPeriod | null;
  readonly totals: ReturnType<typeof summarizePayout>;
}

/**
 * Each driver's own next period, previewed with the same builder the
 * repository uses so the sheet cannot disagree with what issuing produces.
 * Periods are per-driver because they run on from each driver's last
 * settlement, and two drivers rarely settled on the same day.
 */
export function useIssueDrafts(
  drivers: readonly Driver[],
  payouts: readonly Payout[],
  shipments: readonly Shipment[],
): readonly IssueDraft[] {
  return useMemo(() => drivers.map((driver) => {
    const period = nextPeriodForDriver(shipments, payouts, driver.id);
    if (!period) {
      return { driver, lineItems: [], period: null, totals: summarizePayout([]) };
    }
    let sequence = 0;
    const lineItems = buildPayoutLineItems({
      driverId: driver.id,
      nextId: () => { sequence += 1; return `preview-${driver.id}-${sequence}`; },
      periodEnd: period.end,
      periodStart: period.start,
      shipments,
    });
    return { driver, lineItems, period, totals: summarizePayout(lineItems) };
  }), [drivers, payouts, shipments]);
}
