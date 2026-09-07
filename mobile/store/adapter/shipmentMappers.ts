import type { PostalAddress, Shipment, ShipmentStop } from "../../domain/types";
import { equipmentType, shipmentStatus, stringProperty, validDate } from "./fieldCoercion";
import type { MobileShipmentRow } from "./rowTypes";

export function toShipment(row: MobileShipmentRow, customerId: string): Shipment {
  const updatedAt = validDate(row.updatedAt);
  const pickupAt = validDate(row.estimatedPickupAt ?? updatedAt);
  const deliveryAt = validDate(row.estimatedDeliveryAt ?? updatedAt);
  return {
    assignedDriverId: row.driverId ?? undefined,
    billOfLadingNumber: row.bolNumber ?? "Pending",
    charges: { accessorialsCents: 0, currency: "USD", fuelSurchargeCents: 0, linehaulCents: 0 },
    commodity: row.commodity ?? "Freight",
    createdAt: updatedAt,
    customerId,
    distanceMiles: 0,
    entityVersion: Date.parse(updatedAt),
    equipmentType: equipmentType(row.equipmentType),
    estimatedDurationMinutes: 0,
    events: [],
    id: row.id,
    loadNumber: row.loadNumber?.trim() || `MF-${row.id.slice(0, 8).toUpperCase()}`,
    palletCount: row.palletCount ?? 0,
    proNumber: row.proNumber ?? "Pending",
    purchaseOrderNumber: "Pending",
    specialInstructions: row.specialInstructions ?? "",
    status: shipmentStatus(row.status),
    stops: [
      toStop(`${row.id}:pickup`, 1, "pickup", row.origin, pickupAt),
      toStop(`${row.id}:delivery`, 2, "delivery", row.destination, deliveryAt),
    ],
    updatedAt,
    weightPounds: row.weightLbs ?? 0,
  };
}

function toStop(
  id: string,
  sequence: number,
  type: "delivery" | "pickup",
  value: unknown,
  startsAt: string,
): ShipmentStop {
  const address = postalAddress(value);
  return {
    address,
    appointment: { endsAt: startsAt, startsAt, timeZone: "America/Denver" },
    coordinates: { latitude: 0, longitude: 0 },
    facilityName: stringProperty(value, "name") ?? `${address.city} ${type}`,
    id,
    instructions: "",
    sequence,
    status: "pending",
    type,
  };
}

function postalAddress(value: unknown): PostalAddress {
  return {
    city: stringProperty(value, "city") ?? "Unknown",
    countryCode: "US",
    line1: stringProperty(value, "addressLine1") ?? stringProperty(value, "line1") ?? "Address pending",
    line2: stringProperty(value, "addressLine2") ?? stringProperty(value, "line2") ?? undefined,
    postalCode: stringProperty(value, "postalCode") ?? "00000",
    state: stringProperty(value, "state") ?? "CO",
  };
}
