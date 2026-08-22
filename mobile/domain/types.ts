export const APP_ROLES = ["admin", "driver", "customer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/**
 * Server-derived workspace access. `pending_customer_approval` mirrors a
 * `customer/pending` membership: freight requests only, never shipment data.
 */
export const ACCESS_STATES = ["active", "pending_customer_approval"] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

export type EntityId = string;
export type IsoDateTime = string;

export interface OperationsAccount {
  readonly id: EntityId;
  readonly role: AppRole;
  readonly displayName: string;
  readonly email: string;
  readonly companyName: string;
  readonly title: string;
  readonly customerId?: EntityId;
  readonly driverId?: EntityId;
  readonly demoPin?: string;
}

export interface DemoAccount extends OperationsAccount {
  readonly demoPin: string;
}

export interface OperationsSession {
  readonly accountId: EntityId | null;
  readonly effectiveRole: AppRole | null;
  /** Absent in demo/persisted state, where access is always active. */
  readonly accessState?: AccessState;
}

export type DemoSession = OperationsSession;

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface PostalAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: "US";
}

export interface Contact {
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
}

export interface AppointmentWindow {
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly timeZone: string;
}

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

export type DriverAvailability = "available" | "on_duty" | "off_duty" | "suspended";

export interface Driver {
  readonly id: EntityId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly licenseNumber: string;
  readonly licenseState: string;
  readonly licenseClass: "A";
  /** Portrait served by the API. Demo drivers fall back to a bundled asset. */
  readonly avatarUrl?: string;
  readonly status: DriverAvailability;
  readonly currentLocation: GeoPoint;
  readonly locationUpdatedAt: IsoDateTime;
}

export interface Customer {
  readonly id: EntityId;
  readonly companyName: string;
  readonly contact: Contact;
  readonly billingAddress: PostalAddress;
}

export const HOS_DUTY_STATUSES = [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
] as const;

export type HosDutyStatus = (typeof HOS_DUTY_STATUSES)[number];

export interface HosLogEntry {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly status: HosDutyStatus;
  readonly startedAt: IsoDateTime;
  readonly endedAt: IsoDateTime;
  readonly durationMinutes: number;
  readonly locationDescription: string;
  readonly note?: string;
  readonly isSimulated: boolean;
}

export interface HosClock {
  readonly driverId: EntityId;
  readonly status: HosDutyStatus;
  readonly statusStartedAt: IsoDateTime;
  readonly drivingMinutesUsed: number;
  readonly shiftMinutesUsed: number;
  readonly cycleMinutesUsed: number;
  readonly minutesSinceQualifyingBreak: number;
  readonly offDutyMinutesToday: number;
  readonly breaksTakenToday: number;
  readonly entries: readonly HosLogEntry[];
}

export interface HosLimits {
  readonly drivingMinutes: number;
  readonly shiftMinutes: number;
  readonly cycleMinutes: number;
  readonly breakRequiredAfterMinutes: number;
  readonly qualifyingBreakMinutes: number;
  readonly dailyResetMinutes: number;
  readonly cycleResetMinutes: number;
}

export const EXCEPTION_CATEGORIES = [
  "delay",
  "equipment",
  "temperature",
  "cargo_damage",
  "refused_delivery",
  "route",
  "other",
] as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];

export const EXCEPTION_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];
export type ExceptionStatus = "open" | "acknowledged" | "resolved";

export interface ExceptionReport {
  readonly id: EntityId;
  readonly shipmentId: EntityId;
  readonly stopId?: EntityId;
  readonly category: ExceptionCategory;
  readonly severity: ExceptionSeverity;
  readonly status: ExceptionStatus;
  readonly description: string;
  readonly resolutionNote?: string;
  readonly reportedByAccountId: EntityId;
  readonly reportedAt: IsoDateTime;
  readonly resolvedAt?: IsoDateTime;
  readonly attachmentUris: readonly string[];
}

export type ProofOfDeliveryStatus = "draft" | "submitted" | "accepted" | "rejected";

export interface DeliveryAttachment {
  readonly id: EntityId;
  readonly kind: "photo" | "document";
  readonly uri: string;
  readonly name: string;
}

export interface ProofOfDelivery {
  readonly id: EntityId;
  readonly shipmentId: EntityId;
  readonly stopId: EntityId;
  readonly status: ProofOfDeliveryStatus;
  readonly recipientName: string;
  readonly signatureData: string;
  readonly notes: string;
  readonly attachments: readonly DeliveryAttachment[];
  readonly submittedByAccountId: EntityId;
  readonly submittedAt: IsoDateTime;
}

export type MessageThreadKind = "shipment" | "dispatch" | "support";

export interface OperationsMessage {
  readonly id: EntityId;
  readonly threadId: EntityId;
  readonly threadKind: MessageThreadKind;
  readonly shipmentId?: EntityId;
  readonly senderAccountId: EntityId;
  readonly recipientAccountIds: readonly EntityId[];
  readonly body: string;
  readonly sentAt: IsoDateTime;
  readonly readByAccountIds: readonly EntityId[];
}

export type EdiTransactionType = "204" | "990" | "214" | "210" | "997";
export type EdiDirection = "inbound" | "outbound";
export type EdiTransactionStatus = "received" | "generated" | "acknowledged" | "failed";

export interface EdiTransaction {
  readonly id: EntityId;
  readonly shipmentId?: EntityId;
  readonly transactionType: EdiTransactionType;
  readonly direction: EdiDirection;
  readonly status: EdiTransactionStatus;
  readonly senderId: string;
  readonly receiverId: string;
  readonly controlNumber: string;
  readonly summary: string;
  readonly createdAt: IsoDateTime;
  readonly acknowledgedAt?: IsoDateTime;
  readonly isSimulated: boolean;
}


export type CustomerRequestType = "quote" | "pickup" | "delivery" | "exception";
export type CustomerRequestStatus = "draft" | "submitted" | "reviewing" | "scheduled" | "closed";

export interface CustomerRequest {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly shipmentId?: EntityId;
  readonly type: CustomerRequestType;
  readonly status: CustomerRequestStatus;
  readonly subject: string;
  readonly details: string;
  readonly requestedAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type FreightQuoteStatus = "draft" | "sent" | "accepted" | "expired";

export interface FreightQuote {
  readonly id: EntityId;
  readonly quoteNumber: string;
  readonly customerId: EntityId;
  readonly requestId?: EntityId;
  readonly status: FreightQuoteStatus;
  readonly origin: PostalAddress;
  readonly destination: PostalAddress;
  readonly equipmentType: EquipmentType;
  readonly commodity: string;
  readonly estimatedDistanceMiles: number;
  readonly charges: ShipmentCharges;
  readonly totalCents: number;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export type IntegrationHealthStatus =
  | "not_configured"
  | "connected"
  | "degraded";

export interface IntegrationHealth {
  readonly id: EntityId;
  readonly name: string;
  readonly status: IntegrationHealthStatus;
  readonly summary: string;
  readonly lastCheckedAt: IsoDateTime;
  readonly isSimulation: boolean;
}

/**
 * Bumped to 2 when the demo fleet grew from two drivers to five. Persisted v1
 * state fails validation and is rebuilt, which is what a fixture change of
 * this size needs — otherwise a saved demo keeps showing the old fleet.
 */
export const DEMO_STATE_VERSION = 2 as const;

export interface OperationsState {
  readonly version: typeof DEMO_STATE_VERSION;
  readonly session: OperationsSession;
  readonly accounts: readonly OperationsAccount[];
  readonly customers: readonly Customer[];
  readonly drivers: readonly Driver[];
  readonly shipments: readonly Shipment[];
  readonly hosClocks: readonly HosClock[];
  readonly exceptions: readonly ExceptionReport[];
  readonly proofsOfDelivery: readonly ProofOfDelivery[];
  readonly messages: readonly OperationsMessage[];
  readonly ediTransactions: readonly EdiTransaction[];
  readonly requests: readonly CustomerRequest[];
  readonly quotes: readonly FreightQuote[];
  readonly integrations: readonly IntegrationHealth[];
  readonly updatedAt: IsoDateTime;
}

export type DemoOperationsState = OperationsState;

export interface ExceptionReportInput {
  readonly stopId?: EntityId;
  readonly category: ExceptionCategory;
  readonly severity: ExceptionSeverity;
  readonly description: string;
  readonly attachmentUris?: readonly string[];
}

export interface ProofOfDeliveryInput {
  readonly stopId: EntityId;
  readonly recipientName: string;
  readonly signatureData: string;
  readonly notes?: string;
  readonly attachments?: readonly Omit<DeliveryAttachment, "id">[];
}

export interface SendMessageInput {
  readonly threadId: EntityId;
  readonly threadKind: MessageThreadKind;
  readonly shipmentId?: EntityId;
  readonly recipientAccountIds: readonly EntityId[];
  readonly body: string;
}

/** Origin and destination the freight request API requires for intake. */
export interface FreightRequestLocationInput {
  readonly name?: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
}

export interface CreateCustomerRequestInput {
  readonly type: CustomerRequestType;
  readonly subject: string;
  readonly details: string;
  readonly shipmentId?: EntityId;
  readonly origin?: FreightRequestLocationInput;
  readonly destination?: FreightRequestLocationInput;
}
