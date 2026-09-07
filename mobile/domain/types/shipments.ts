import type {
  AppointmentWindow,
  Contact,
  EntityId,
  GeoPoint,
  IsoDateTime,
  PostalAddress,
} from "./core";

export type StopType = "pickup" | "intermediate" | "delivery";
export type StopStatus = "pending" | "arrived" | "completed" | "skipped";

export interface ShipmentStop {
  readonly id: EntityId;
  readonly sequence: number;
  readonly type: StopType;
  readonly status: StopStatus;
  readonly facilityName: string;
  readonly facilityReference?: string;
  readonly address: PostalAddress;
  readonly coordinates: GeoPoint;
  readonly appointment: AppointmentWindow;
  readonly instructions: string;
  readonly contact?: Contact;
  readonly arrivedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
}

export const SHIPMENT_STATUSES = [
  "tendered",
  "accepted",
  "declined",
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
  "delivered",
  "exception",
  "cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export type ShipmentEventType =
  | "tender_received"
  | "tender_accepted"
  | "tender_declined"
  | "dispatched"
  | "arrived_at_pickup"
  | "loaded"
  | "departed_pickup"
  | "location_update"
  | "arrived_at_stop"
  | "departed_stop"
  | "arrived_at_delivery"
  | "delivered"
  | "exception_reported"
  | "exception_resolved"
  | "cancelled";

export type ShipmentEventSource = "admin" | "customer" | "driver" | "system";

export interface ShipmentEvent {
  readonly id: EntityId;
  readonly shipmentId: EntityId;
  readonly type: ShipmentEventType;
  readonly eventCode: string;
  readonly source: ShipmentEventSource;
  readonly occurredAt: IsoDateTime;
  readonly description: string;
  readonly resultingStatus?: ShipmentStatus;
  readonly stopId?: EntityId;
  readonly coordinates?: GeoPoint;
  readonly isSimulated: boolean;
}

export interface ShipmentCharges {
  readonly linehaulCents: number;
  readonly fuelSurchargeCents: number;
  readonly accessorialsCents: number;
  readonly currency: "USD";
}

export type EquipmentType = "dry_van" | "reefer" | "flatbed";

export interface Shipment {
  readonly id: EntityId;
  readonly entityVersion?: number;
  readonly loadNumber: string;
  readonly purchaseOrderNumber: string;
  readonly billOfLadingNumber: string;
  readonly proNumber: string;
  readonly customerId: EntityId;
  readonly assignedDriverId?: EntityId;
  readonly status: ShipmentStatus;
  readonly commodity: string;
  readonly weightPounds: number;
  readonly palletCount: number;
  readonly equipmentType: EquipmentType;
  readonly temperatureFahrenheit?: number;
  readonly distanceMiles: number;
  readonly estimatedDurationMinutes: number;
  readonly charges: ShipmentCharges;
  readonly specialInstructions: string;
  readonly stops: readonly ShipmentStop[];
  readonly events: readonly ShipmentEvent[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
