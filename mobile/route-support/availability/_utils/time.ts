/**
 * Calendar maths for driver availability.
 *
 * Every conversion between a calendar day and an instant goes through the
 * device's own zone via the `Date` constructor, which is the same zone
 * `formatDateKey` reports. That matters at a DST boundary: "eight hours after
 * local midnight" has to stay 8am on the day the clocks move, and only the
 * local constructor normalizes that correctly.
 */

export const MINUTES_PER_DAY = 1_440;

/** The drag track snaps here. Fifteen minutes is what dispatch schedules on. */
export const SNAP_MINUTES = 15;

/** Local midnight on the given `YYYY-MM-DD`. */
export function localDayStart(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * An instant `minute` minutes after local midnight. The `Date` constructor
 * normalizes out-of-range values, so 1,440 lands on the next midnight and a
 * time that a spring-forward skipped rolls to the hour that does exist.
 */
export function minutesToIso(dateKey: string, minute: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, minute, 0, 0).toISOString();
}

/** Minutes from local midnight for an instant, clamped to the day it lands in. */
export function isoToMinutes(iso: string, dateKey: string): number {
  const start = localDayStart(dateKey).getTime();
  const delta = (Date.parse(iso) - start) / 60_000;
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(delta)));
}

export function snapMinute(minute: number, step: number = SNAP_MINUTES): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute / step) * step));
}

/** `510` becomes `8:30 AM`. */
export function formatMinute(minute: number): string {
  const normalized = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  if (minute >= MINUTES_PER_DAY) {
    return "12 AM";
  }
  return minutes === 0 ? `${hour12} ${meridiem}` : `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function formatMinuteRange(startMinute: number, endMinute: number): string {
  if (startMinute === 0 && endMinute >= MINUTES_PER_DAY) {
    return "All day";
  }
  return `${formatMinute(startMinute)} – ${formatMinute(endMinute)}`;
}
