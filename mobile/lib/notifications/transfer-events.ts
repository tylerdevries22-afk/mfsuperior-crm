export interface VehicleTransferNotification {
  readonly eventId: string;
  readonly fromDriverName: string | null;
  readonly note: string;
  readonly targetDriverName: string;
  readonly vehicleId: string;
  readonly vehicleUnitNumber: string;
}

const seenTransferEvents = new Set<string>();

export function parseVehicleTransferNotification(value: unknown): VehicleTransferNotification | null {
  if (!isRecord(value)) return null;
  const eventId = stringValue(value.id);
  const vehicleId = stringValue(value.vehicle_id);
  const vehicleUnitNumber = stringValue(value.vehicle_unit_number);
  const targetDriverName = stringValue(value.target_driver_name);
  if (!eventId || !vehicleId || !vehicleUnitNumber || !targetDriverName) return null;
  return {
    eventId,
    fromDriverName: nullableStringValue(value.from_driver_name),
    note: stringValue(value.note) ?? "",
    targetDriverName,
    vehicleId,
    vehicleUnitNumber,
  };
}

export function transferEventId(value: unknown): string | null {
  return isRecord(value) ? stringValue(value.eventId) : null;
}

export function markTransferEventSeen(eventId: string): boolean {
  if (seenTransferEvents.has(eventId)) return false;
  seenTransferEvents.add(eventId);
  return true;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
