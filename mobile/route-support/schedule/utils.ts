import type { ImageSourcePropType } from "react-native";

import type { Driver, Shipment, ShipmentStop } from "@/domain/types";

/**
 * Date, layout, and formatting helpers for the schedule.
 *
 * Ported from the Appliance Diagnostic Systems schedule at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. The calendar maths — week window,
 * timezone-stable date keys, hour grid, duration formatting — is kept
 * identical so both schedules lay out the same. Only the domain changes:
 * jobs become loads, technicians become drivers, and appliance category
 * artwork becomes freight equipment artwork.
 */

export const EQUIPMENT_IMAGES: Record<string, ImageSourcePropType> = {
  // Metro resolves bundled React Native assets through static require calls.
   
  dry_van: require("@/assets/freight/equipment-dry-van.webp"),
   
  reefer: require("@/assets/freight/equipment-reefer.webp"),
   
  flatbed: require("@/assets/freight/equipment-flatbed.webp"),
};

export const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
export const HOUR_HEIGHT = 60;
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
export const FALLBACK_COLOR = "#6B7280";

/**
 * The reference resolves a tenant timezone. Freight operations run against the
 * device's own zone, so the schedule uses it directly and keeps every date key
 * derived from the same source.
 */
export const SCHEDULE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function middayFor(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

export function formatDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: SCHEDULE_TZ });
}

export function addDays(date: Date, n: number): Date {
  return middayFor(shiftDateKey(formatDateKey(date), n));
}

/** Four weeks back through six weeks forward, aligned to Sunday. */
export function getWeekDates(baseDate: Date): Date[] {
  const baseKey = formatDateKey(baseDate);
  const sundayKey = shiftDateKey(baseKey, -middayFor(baseKey).getUTCDay());
  const WEEKS_BACK = 4;
  const WEEKS_TOTAL = 10;
  const startKey = shiftDateKey(sundayKey, -WEEKS_BACK * 7);
  return Array.from({ length: WEEKS_TOTAL * 7 }, (_, index) =>
    middayFor(shiftDateKey(startKey, index)),
  );
}

export function getHoursInTz(iso: string): {
  hours: number;
  minutes: number;
  h12: number;
  ampm: string;
} {
  const timeStr = new Date(iso).toLocaleTimeString("en-US", {
    timeZone: SCHEDULE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hStr, mStr] = timeStr.split(":");
  let hours = parseInt(hStr, 10);
  if (hours === 24) hours = 0;
  const minutes = parseInt(mStr, 10) || 0;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return { hours, minutes, h12, ampm };
}

export function formatTime(iso: string): string {
  const { h12, minutes, ampm } = getHoursInTz(iso);
  return minutes === 0 ? `${h12} ${ampm}` : `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export function getDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
  if (diff < 1) return `${Math.round(diff * 60)}m`;
  return diff === Math.floor(diff) ? `${diff}h` : `${diff.toFixed(1)}h`;
}

export function isToday(d: Date): boolean {
  return formatDateKey(d) === formatDateKey(new Date());
}

export function formatDayHeader(dateStr: string): string {
  const d = middayFor(dateStr);
  const todayKey = formatDateKey(new Date());

  let prefix = "";
  if (dateStr === todayKey) prefix = "Today · ";
  else if (dateStr === shiftDateKey(todayKey, -1)) prefix = "Yesterday · ";
  else if (dateStr === shiftDateKey(todayKey, 1)) prefix = "Tomorrow · ";

  const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = parseInt(d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" }), 10);
  return `${prefix}${dayName} ${month} ${day}`;
}

export function getInitials(first?: string | null, last?: string | null): string {
  return [(first || "")[0], (last || "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

/**
 * Stable per-driver colour. The reference reads a colour assigned by the
 * scheduling provider; freight drivers carry no such field, so the palette is
 * hashed from the driver id and therefore stable across sessions and devices.
 */
const DRIVER_COLORS = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

export function hashColor(seed: string, palette: readonly string[] = DRIVER_COLORS): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function buildDriverColors(drivers: readonly Driver[]): Record<string, string> {
  return Object.fromEntries(drivers.map((driver) => [driver.id, hashColor(driver.id)]));
}

export function getLoadColor(
  shipment: Pick<Shipment, "assignedDriverId">,
  driverColors: Record<string, string>,
): string {
  const assigned = shipment.assignedDriverId;
  if (!assigned) return FALLBACK_COLOR;
  const hex = driverColors[assigned];
  if (!hex) return FALLBACK_COLOR;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

const CLOSED_STATUSES = new Set<string>(["delivered", "cancelled", "declined"]);

export function isLoadPast(shipment: Shipment, reference: Date = new Date()): boolean {
  if (CLOSED_STATUSES.has(shipment.status)) return true;
  const end = scheduledEnd(shipment);
  return end !== null && new Date(end) < reference;
}

/** A load's schedule window is its first pickup through its final delivery. */
export function scheduledStart(shipment: Shipment): string | null {
  return orderedStops(shipment)[0]?.appointment.startsAt ?? null;
}

export function scheduledEnd(shipment: Shipment): string | null {
  const stops = orderedStops(shipment);
  return stops[stops.length - 1]?.appointment.endsAt ?? null;
}

export function orderedStops(shipment: Shipment): readonly ShipmentStop[] {
  return [...shipment.stops].sort((a, b) => a.sequence - b.sequence);
}

export function getAssignedDrivers(
  shipment: Shipment,
  drivers: readonly Driver[],
): readonly Driver[] {
  if (!shipment.assignedDriverId) return [];
  return drivers.filter((driver) => driver.id === shipment.assignedDriverId);
}

export function driverFullName(driver: Driver): string {
  return [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
}
