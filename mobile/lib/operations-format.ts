import type { AppointmentWindow, PostalAddress, Shipment, ShipmentStatus } from "@/domain/types";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatStatus(status: string): string {
  return status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatCurrency(cents: number): string {
  return CURRENCY_FORMATTER.format(cents / 100);
}

export function formatAppointment(window: AppointmentWindow): string {
  const startsAt = new Date(window.startsAt);
  const endsAt = new Date(window.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return "Time unavailable";

  try {
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: window.timeZone,
    });
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: window.timeZone,
    });
    return `${dateFormatter.format(startsAt)} · ${timeFormatter.format(startsAt)}–${timeFormatter.format(endsAt)}`;
  } catch {
    return "Time unavailable";
  }
}

export function formatAddress(address: PostalAddress): string {
  return `${address.city}, ${address.state}`;
}

export function shipmentRoute(shipment: Shipment): string {
  const firstStop = shipment.stops[0];
  const lastStop = shipment.stops.at(-1);
  if (!firstStop || !lastStop) return "Route pending";
  return `${formatAddress(firstStop.address)} → ${formatAddress(lastStop.address)}`;
}

export function shipmentProgress(status: ShipmentStatus): number {
  const progress: Readonly<Record<ShipmentStatus, number>> = {
    tendered: 0.08,
    accepted: 0.16,
    declined: 0,
    dispatched: 0.26,
    at_pickup: 0.38,
    loaded: 0.5,
    in_transit: 0.68,
    at_delivery: 0.86,
    delivered: 1,
    exception: 0.56,
    cancelled: 0,
  };
  return progress[status];
}

export function remainingMinutes(usedMinutes: number, limitMinutes: number): number {
  if (!Number.isFinite(usedMinutes) || !Number.isFinite(limitMinutes)) return 0;
  return Math.max(0, Math.round(limitMinutes - usedMinutes));
}

export function formatMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
