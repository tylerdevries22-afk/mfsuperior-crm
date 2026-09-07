/**
 * Calendar maths for driver availability.
 *
 * This module is the public surface; the implementation lives in `./_utils`,
 * split by concern (`time`, `monthGrid`, `blocks`, `summary`, `conflicts`).
 * Every export below is re-exported by name rather than with `export *`, so the
 * surface stays exactly what callers already import and the helpers each part
 * keeps to itself (`mergedMinutes`, `oppositeKind`) stay private.
 *
 * See `./_utils/time` for why every day/instant conversion goes through the
 * device's own zone: it is what keeps wall-clock times correct across DST.
 */

export {
  blocksForDay,
  dayKeysBetween,
  expandRulesForDay,
  isBlocking,
  overlapsDay,
} from "./_utils/blocks";
export { findAvailabilityConflicts, loadRouteLabel } from "./_utils/conflicts";
export { buildMonthGrid, monthLabel, shiftMonth } from "./_utils/monthGrid";
export type { MonthCell } from "./_utils/monthGrid";
export { loadTouchesDay, summarizeDay } from "./_utils/summary";
export type { DaySummary } from "./_utils/summary";
export {
  formatMinute,
  formatMinuteRange,
  isoToMinutes,
  localDayStart,
  MINUTES_PER_DAY,
  minutesToIso,
  snapMinute,
  SNAP_MINUTES,
} from "./_utils/time";
