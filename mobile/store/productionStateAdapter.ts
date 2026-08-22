import type {
  AppRole,
  CustomerRequest,
  DemoOperationsState,
  Driver,
  EquipmentType,
  IntegrationHealth,
  OperationsAccount,
  PostalAddress,
  Shipment,
  ShipmentStatus,
  ShipmentStop,
} from "../domain/types";
import { DEMO_STATE_VERSION, SHIPMENT_STATUSES } from "../domain/types";
import type { AuthIdentity } from "../lib/auth";

export interface MobileBootstrapPayload {
  readonly integrations: readonly {
    readonly lastSucceededAt: string | null;
    readonly provider: string;
    readonly status: "connected" | "degraded" | "disabled" | "not_configured";
  }[];
  readonly organization: { readonly id: string; readonly name: string };
  readonly referenceData: {
    readonly drivers: readonly MobileDriverRow[];
  };
  readonly user: {
    readonly customerAccountId: string | null;
    readonly displayName: string;
    readonly driverId: string | null;
    readonly email: string;
    readonly id: string;
    readonly role: AppRole;
  };
}

export interface MobileDriverRow {
  readonly currentLat: string | null;
  readonly currentLng: string | null;
  readonly email: string | null;
  readonly firstName: string;
  readonly id: string;
  readonly lastName: string;
  readonly licenseNumber: string | null;
  readonly licenseState: string | null;
  readonly locationUpdatedAt: string | null;
  readonly phone: string | null;
  readonly status: Driver["status"];
}

export interface MobileShipmentRow {
  readonly bolNumber: string | null;
  readonly commodity: string | null;
  readonly destination: unknown;
  readonly driverId: string | null;
  readonly equipmentType: string | null;
  readonly estimatedDeliveryAt: string | null;
  readonly estimatedPickupAt: string | null;
  readonly id: string;
  readonly loadNumber: string | null;
  readonly origin: unknown;
  readonly palletCount: number | null;
  readonly proNumber: string | null;
  readonly specialInstructions: string | null;
  readonly status: string;
  readonly updatedAt: string;
  readonly weightLbs: number | null;
}

export interface MobileFreightRequestRow {
  readonly commodity: string | null;
  readonly createdAt: string;
  readonly customerAccountId: string | null;
  readonly equipmentType: string | null;
  readonly id: string;
  readonly notes: string | null;
  readonly referenceNumber: string | null;
  readonly shipmentId: string | null;
  readonly status: string;
  readonly updatedAt: string;
}

/** Convert the versioned mobile API payload into the UI's normalized operations state. */
export function buildProductionOperationsState(
  bootstrap: MobileBootstrapPayload,
  shipmentRows: readonly MobileShipmentRow[],
  requestRows: readonly MobileFreightRequestRow[],
  now: string,
): DemoOperationsState {
  const customerId = bootstrap.user.customerAccountId ?? `pending:${bootstrap.user.id}`;
  const account = {
    companyName: bootstrap.organization.name,
    customerId: bootstrap.user.role === "customer" ? customerId : undefined,
    displayName: bootstrap.user.displayName,
    driverId: bootstrap.user.driverId ?? undefined,
    email: bootstrap.user.email,
    id: bootstrap.user.id,
    role: bootstrap.user.role,
    title: titleForRole(bootstrap.user.role),
  };
  return {
    accounts: [account],
    customers: [],
    drivers: bootstrap.referenceData.drivers.map(toDriver),
    ediTransactions: [],
    equipment: [],
    exceptions: [],
    hosClocks: bootstrap.user.driverId ? [{
      breaksTakenToday: 0,
      cycleMinutesUsed: 0,
      driverId: bootstrap.user.driverId,
      drivingMinutesUsed: 0,
      entries: [],
      minutesSinceQualifyingBreak: 0,
      offDutyMinutesToday: 0,
      shiftMinutesUsed: 0,
      status: "off_duty",
      statusStartedAt: now,
    }] : [],
    integrations: bootstrap.integrations.map((integration) => toIntegration(integration, now)),
    messages: [],
    proofsOfDelivery: [],
    quotes: [],
    requests: requestRows.map((request) => toCustomerRequest(request, customerId)),
    session: { accessState: "active", accountId: account.id, effectiveRole: account.role },
    shipments: shipmentRows.map((shipment) => toShipment(shipment, customerId)),
    updatedAt: now,
    version: DEMO_STATE_VERSION,
  };
}

/**
 * Build the state a `customer/pending` membership is allowed to see. Bootstrap,
 * shipments, drivers, and reference data stay empty because the server refuses
 * them until an admin links the customer account.
 */
export function buildPendingCustomerOperationsState(
  identity: AuthIdentity,
  requestRows: readonly MobileFreightRequestRow[],
  now: string,
): DemoOperationsState {
  const customerId = identity.customerAccountId ?? `pending:${identity.userId}`;
  const account: OperationsAccount = {
    companyName: "MF Superior Products",
    customerId,
    displayName: identity.email.split("@")[0],
    email: identity.email,
    id: identity.userId,
    role: "customer",
    title: titleForRole("customer"),
  };
  return {
    accounts: [account],
    customers: [],
    drivers: [],
    ediTransactions: [],
    equipment: [],
    exceptions: [],
    hosClocks: [],
    integrations: [],
    messages: [],
    proofsOfDelivery: [],
    quotes: [],
    requests: requestRows.map((request) => toCustomerRequest(request, customerId)),
    session: {
      accessState: "pending_customer_approval",
      accountId: account.id,
      effectiveRole: "customer",
    },
    shipments: [],
    updatedAt: now,
    version: DEMO_STATE_VERSION,
  };
}

function toDriver(row: MobileDriverRow): Driver {
  return {
    currentLocation: {
      latitude: finiteCoordinate(row.currentLat),
      longitude: finiteCoordinate(row.currentLng),
    },
    email: row.email ?? "",
    firstName: row.firstName,
    id: row.id,
    lastName: row.lastName,
    licenseClass: "A",
    licenseNumber: row.licenseNumber ?? "Pending",
    licenseState: row.licenseState ?? "CO",
    locationUpdatedAt: row.locationUpdatedAt ?? new Date(0).toISOString(),
    phone: row.phone ?? "",
    status: row.status,
  };
}

function toShipment(row: MobileShipmentRow, customerId: string): Shipment {
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

function toCustomerRequest(row: MobileFreightRequestRow, fallbackCustomerId: string): CustomerRequest {
  const closed = row.status === "declined" || row.status === "cancelled";
  return {
    customerId: row.customerAccountId ?? fallbackCustomerId,
    details: row.notes ?? "Freight request submitted through the customer workspace.",
    id: row.id,
    requestedAt: validDate(row.createdAt),
    shipmentId: row.shipmentId ?? undefined,
    status: closed ? "closed" : row.status === "booked" ? "scheduled" : row.status === "reviewing" || row.status === "quoted" ? "reviewing" : "submitted",
    subject: row.referenceNumber ?? row.commodity ?? "Freight request",
    type: row.shipmentId ? "delivery" : "quote",
    updatedAt: validDate(row.updatedAt),
  };
}

function toIntegration(
  row: MobileBootstrapPayload["integrations"][number],
  now: string,
): IntegrationHealth {
  const status = row.status === "disabled" ? "not_configured" : row.status;
  return {
    id: row.provider,
    isSimulation: false,
    lastCheckedAt: row.lastSucceededAt ?? now,
    name: row.provider,
    status,
    summary: status === "connected" ? "Connection verified" : status === "degraded" ? "Connection requires attention" : "Credentials required",
  };
}

function shipmentStatus(value: string): ShipmentStatus {
  return SHIPMENT_STATUSES.some((status) => status === value) ? value as ShipmentStatus : "exception";
}

function equipmentType(value: string | null): EquipmentType {
  return value === "reefer" || value === "flatbed" ? value : "dry_van";
}

function finiteCoordinate(value: string | null): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
}

function validDate(value: string): string {
  return Number.isNaN(Date.parse(value)) ? new Date(0).toISOString() : value;
}

function stringProperty(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function titleForRole(role: AppRole): string {
  if (role === "admin") return "Operations administrator";
  if (role === "driver") return "Professional driver";
  return "Customer account";
}
