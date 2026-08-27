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
 * Fleet, availability, maintenance, compliance, and payout records.
 *
 * Every timestamp below is a full `IsoDateTime` rather than a calendar date
 * because `anchorDemoStateTo` shifts the demo clock by walking the state for
 * parseable ISO strings. A bare "2026-09-03" would not move, so a document
 * seeded to expire twelve days out would drift further away every day.
 */

export const AVAILABILITY_KINDS = [
  "available",
  "unavailable",
  "time_off",
  "preferred",
] as const;

export type AvailabilityKind = (typeof AVAILABILITY_KINDS)[number];

/** A concrete span on one driver's calendar. */
export interface AvailabilityBlock {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly kind: AvailabilityKind;
  readonly note?: string;
  /** Set when the block was expanded from a recurring rule. */
  readonly ruleId?: EntityId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/**
 * A repeating weekly pattern. Minutes are local to the driver's schedule
 * timezone and measured from midnight, so a rule survives a DST boundary that
 * a stored wall-clock timestamp would not.
 */
export interface AvailabilityRule {
  readonly id: EntityId;
  readonly driverId: EntityId;
  /** 0 is Sunday, matching `Date.prototype.getDay`. */
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly kind: AvailabilityKind;
  readonly effectiveFrom: IsoDateTime;
  readonly effectiveUntil?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export const VEHICLE_TYPES = ["tractor", "trailer"] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = [
  "active",
  "in_shop",
  "out_of_service",
  "retired",
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface Vehicle {
  readonly id: EntityId;
  readonly unitNumber: string;
  readonly type: VehicleType;
  readonly vin: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly plateNumber: string;
  readonly plateState: string;
  readonly status: VehicleStatus;
  readonly odometerMiles: number;
  readonly assignedDriverId?: EntityId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export const MAINTENANCE_KINDS = ["repair", "preventive", "inspection"] as const;

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export const MAINTENANCE_STATUSES = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type MaintenanceSeverity = (typeof MAINTENANCE_SEVERITIES)[number];

export interface MaintenanceOrder {
  readonly id: EntityId;
  readonly vehicleId: EntityId;
  readonly kind: MaintenanceKind;
  readonly status: MaintenanceStatus;
  readonly severity: MaintenanceSeverity;
  readonly summary: string;
  readonly description: string;
  readonly openedAt: IsoDateTime;
  readonly scheduledFor?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly odometerMiles?: number;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly reportedByDriverId?: EntityId;
  readonly updatedAt: IsoDateTime;
}

export const COMPLIANCE_SUBJECT_TYPES = ["vehicle", "driver"] as const;

export type ComplianceSubjectType = (typeof COMPLIANCE_SUBJECT_TYPES)[number];

export const COMPLIANCE_DOCUMENT_KINDS = [
  "registration",
  "ifta",
  "annual_inspection",
  "insurance",
  "cdl",
  "medical_card",
  "hazmat_endorsement",
] as const;

export type ComplianceDocumentKind = (typeof COMPLIANCE_DOCUMENT_KINDS)[number];

export interface ComplianceDocument {
  readonly id: EntityId;
  readonly subjectType: ComplianceSubjectType;
  readonly subjectId: EntityId;
  readonly kind: ComplianceDocumentKind;
  readonly identifier: string;
  readonly issuingState: string;
  readonly issuedOn: IsoDateTime;
  readonly expiresOn: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/**
 * Where a driver wants to be paid. The handle is an account identifier a
 * driver publishes anyway — a Venmo username, a Cash App cashtag, the phone
 * or email behind Zelle or Apple Cash. It is never a card number, a bank
 * account, or a credential, and nothing in this app moves money.
 */
export const PAYOUT_RAILS = ["apple_cash", "venmo", "cash_app", "zelle"] as const;

export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export interface PayoutMethod {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly rail: PayoutRail;
  readonly handle: string;
  readonly label?: string;
  readonly isDefault: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export const PAYOUT_STATUSES = ["pending", "processing", "paid", "failed"] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_LINE_ITEM_KINDS = [
  "linehaul",
  "accessorial",
  "detention",
  "fuel",
  "advance",
  "deduction",
] as const;

export type PayoutLineItemKind = (typeof PAYOUT_LINE_ITEM_KINDS)[number];

export interface PayoutLineItem {
  readonly id: EntityId;
  readonly shipmentId?: EntityId;
  readonly kind: PayoutLineItemKind;
  readonly description: string;
  /** Negative for deductions, so the line items always sum to `netCents`. */
  readonly amountCents: number;
}

/**
 * A settlement record. `markPayoutPaid` records that a transfer happened on
 * the named rail; it does not initiate one.
 */
export interface Payout {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly periodStart: IsoDateTime;
  readonly periodEnd: IsoDateTime;
  readonly status: PayoutStatus;
  readonly grossCents: number;
  readonly deductionCents: number;
  readonly netCents: number;
  readonly rail?: PayoutRail;
  readonly methodId?: EntityId;
  readonly issuedAt?: IsoDateTime;
  readonly paidAt?: IsoDateTime;
  readonly lineItems: readonly PayoutLineItem[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/**
 * Bumped to 4 when the seeded settlement periods moved onto the two weeks
 * before the fixture clock.
 *
 * The lesson of that change: the version guards fixture *content*, not just
 * the state's shape. Moving the payout periods without bumping it left every
 * device that already held v3 state reusing the old periods, which covered the
 * one delivered load and made settlements permanently unissuable — a bug no
 * amount of fixing the fixtures could reach, because the fixtures were never
 * read again. Bump this whenever seeded data changes in a way a screen reads.
 */
export const DEMO_STATE_VERSION = 5 as const;

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
  readonly vehicles: readonly Vehicle[];
  readonly availabilityBlocks: readonly AvailabilityBlock[];
  readonly availabilityRules: readonly AvailabilityRule[];
  readonly driverShifts: readonly DriverShift[];
  readonly shiftCoverageRequests: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses: readonly ScheduleSyncStatus[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly complianceDocuments: readonly ComplianceDocument[];
  readonly payouts: readonly Payout[];
  readonly updatedAt: IsoDateTime;
}

export type DemoOperationsState = OperationsState;

export const DRIVER_SHIFT_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type DriverShiftStatus = (typeof DRIVER_SHIFT_STATUSES)[number];

/** A schedulable occurrence. Jobs retain their original assignment during coverage. */
export interface DriverShift {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly status: DriverShiftStatus;
  readonly note?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface DriverShiftInput {
  readonly id?: EntityId;
  readonly driverId: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly status?: DriverShiftStatus;
  readonly note?: string;
}

export const SHIFT_COVERAGE_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "closed",
] as const;

export type ShiftCoverageRequestStatus = (typeof SHIFT_COVERAGE_REQUEST_STATUSES)[number];

/** A request changes only the linked shift, never its shipment assignments. */
export interface ShiftCoverageRequest {
  readonly id: EntityId;
  readonly shiftId: EntityId;
  readonly fromDriverId: EntityId;
  readonly targetDriverId: EntityId;
  readonly requestedByAccountId: EntityId;
  readonly status: ShiftCoverageRequestStatus;
  readonly createdAt: IsoDateTime;
  readonly respondedAt?: IsoDateTime;
}

export interface ShiftCoverageRequestInput {
  readonly shiftId: EntityId;
  readonly targetDriverId: EntityId;
}

export const SCHEDULE_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
] as const;

export type ScheduleSyncState = (typeof SCHEDULE_SYNC_STATUSES)[number];

/** Target is an integration boundary; credentials can be added without changing calendar data. */
export interface ScheduleSyncStatus {
  readonly id: EntityId;
  readonly entityType: "shift";
  readonly entityId: EntityId;
  readonly provider: "target";
  readonly status: ScheduleSyncState;
  readonly attempts: number;
  readonly lastAttemptAt?: IsoDateTime;
  readonly lastError?: string;
  readonly updatedAt: IsoDateTime;
}

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

export interface AvailabilityBlockInput {
  /** Admins may write any driver's calendar; drivers may only write their own. */
  readonly driverId?: EntityId;
  /** Omitted when creating; supplied to replace an existing block in place. */
  readonly id?: EntityId;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly kind: AvailabilityKind;
  readonly note?: string;
}

export interface AvailabilityRuleInput {
  readonly driverId?: EntityId;
  readonly id?: EntityId;
  readonly weekday: AvailabilityRule["weekday"];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly kind: AvailabilityKind;
  readonly effectiveFrom: IsoDateTime;
  readonly effectiveUntil?: IsoDateTime;
}

export interface PayoutMethodInput {
  readonly id?: EntityId;
  readonly rail: PayoutRail;
  readonly handle: string;
  readonly label?: string;
  readonly isDefault?: boolean;
}

export interface VehicleInput {
  readonly id?: EntityId;
  readonly unitNumber: string;
  readonly type: VehicleType;
  readonly vin: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly plateNumber: string;
  readonly plateState: string;
  readonly status: VehicleStatus;
  readonly odometerMiles: number;
  readonly assignedDriverId?: EntityId;
}

export interface MaintenanceOrderInput {
  readonly vehicleId: EntityId;
  readonly kind: MaintenanceKind;
  readonly severity: MaintenanceSeverity;
  readonly summary: string;
  readonly description: string;
  readonly scheduledFor?: IsoDateTime;
  readonly odometerMiles?: number;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly reportedByDriverId?: EntityId;
}

export interface MaintenanceOrderPatch {
  readonly status?: MaintenanceStatus;
  readonly severity?: MaintenanceSeverity;
  readonly scheduledFor?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly vendorName?: string;
  readonly costCents?: number;
  readonly description?: string;
}

export interface ComplianceDocumentInput {
  readonly id?: EntityId;
  readonly subjectType: ComplianceSubjectType;
  readonly subjectId: EntityId;
  readonly kind: ComplianceDocumentKind;
  readonly identifier: string;
  readonly issuingState: string;
  readonly issuedOn: IsoDateTime;
  readonly expiresOn: IsoDateTime;
}
