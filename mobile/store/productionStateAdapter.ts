import { normalizeVehicle } from "../domain/vehicleCompatibility";
import type { DemoOperationsState, OperationsAccount } from "../domain/types";
import { DEMO_STATE_VERSION } from "../domain/types";
import type { AuthIdentity } from "../lib/auth";
import { mergeContacts, toDriver, toIntegration } from "./adapter/accountMappers";
import {
  toCustomerRequest,
  toExceptionReport,
  toOperationsMessage,
} from "./adapter/activityMappers";
import { titleForRole } from "./adapter/fieldCoercion";
import { toShipment } from "./adapter/shipmentMappers";
import type { MobileFreightRequestRow, ProductionHydrationInput } from "./adapter/rowTypes";

export type {
  MobileBootstrapPayload,
  MobileContactRow,
  MobileDriverRow,
  MobileExceptionRow,
  MobileFreightRequestRow,
  MobileMessageRow,
  MobileShipmentRow,
  ProductionHydrationInput,
} from "./adapter/rowTypes";

/** Convert the versioned mobile API payload into the UI's normalized operations state. */
export function buildProductionOperationsState(
  input: ProductionHydrationInput,
  now: string,
): DemoOperationsState {
  const { bootstrap } = input;
  const customerId = bootstrap.user.customerAccountId ?? `pending:${bootstrap.user.id}`;
  const account: OperationsAccount = {
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
    accounts: mergeContacts(account, bootstrap),
    availabilityBlocks: input.availabilityBlocks ?? [],
    availabilityRules: input.availabilityRules ?? [],
    driverShifts: input.driverShifts ?? [],
    shiftCoverageRequests: input.shiftCoverageRequests ?? [],
    scheduleSyncStatuses: input.scheduleSyncStatuses ?? [],
    complianceDocuments: input.complianceDocuments ?? [],
    customers: [],
    drivers: bootstrap.referenceData.drivers.map(toDriver),
    ediTransactions: [],
    exceptions: input.exceptions.map(toExceptionReport),
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
    maintenanceOrders: input.maintenanceOrders ?? [],
    messages: input.messages.map(toOperationsMessage),
    payouts: input.payouts ?? [],
    proofsOfDelivery: [],
    quotes: [],
    requests: input.requests.map((request) => toCustomerRequest(request, customerId)),
    session: { accessState: "active", accountId: account.id, effectiveRole: account.role },
    shipments: input.shipments.map((shipment) => toShipment(shipment, customerId)),
    updatedAt: now,
    vehicles: (input.vehicles ?? []).map(normalizeVehicle),
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
    availabilityBlocks: [],
    availabilityRules: [],
    driverShifts: [],
    shiftCoverageRequests: [],
    scheduleSyncStatuses: [],
    complianceDocuments: [],
    customers: [],
    drivers: [],
    ediTransactions: [],
    exceptions: [],
    hosClocks: [],
    integrations: [],
    maintenanceOrders: [],
    messages: [],
    payouts: [],
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
    vehicles: [],
    version: DEMO_STATE_VERSION,
  };
}
