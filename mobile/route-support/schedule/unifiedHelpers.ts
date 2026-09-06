import type {
  DriverShift
} from "@/domain/types";
import {
  localDayStart
} from "@/route-support/availability/utils";

export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function shiftTouchesDay(shift: DriverShift, dateKey: string): boolean {
  const start = localDayStart(dateKey).getTime();
  const end = addDays(localDayStart(dateKey), 1).getTime();
  return Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start;
}

export function weekRangeLabel(dates: readonly Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "Schedule";
  const firstLabel = first.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const lastLabel = last.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  return `${firstLabel} – ${lastLabel}`;
}

export function formatSheetDate(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", timeZone: "UTC", weekday: "long" });
}
