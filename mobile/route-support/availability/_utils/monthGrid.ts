import { formatDateKey } from "@/route-support/schedule/utils";

/** One cell of the six-by-seven month grid. */
export interface MonthCell {
  readonly dateKey: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly weekday: number;
}

/**
 * Six rows of seven, Sunday-aligned, so the grid never changes height between
 * months and the cells never reflow under the drag selection.
 */
export function buildMonthGrid(year: number, month: number): readonly MonthCell[] {
  const first = new Date(year, month, 1);
  const leading = first.getDay();
  const cells: MonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, 1 - leading + index);
    cells.push({
      dateKey: formatDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      weekday: date.getDay(),
    });
  }
  return cells;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Shifts a `{year, month}` pair by whole months without leaving the year broken. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(year, month + delta, 1);
  return { month: shifted.getMonth(), year: shifted.getFullYear() };
}
