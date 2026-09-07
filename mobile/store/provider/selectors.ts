import type { OperationsFailure } from "../../domain/errors";
import type { DemoOperationsState } from "../../domain/types";
import type { OperationsActions, OperationsContextValue } from "./types";

export interface OperationsContextInputs {
  readonly state: DemoOperationsState;
  readonly isHydrated: boolean;
  readonly isDemo: boolean;
  readonly error: OperationsFailure | null;
  readonly actions: OperationsActions;
}

/**
 * Narrows the whole operations state down to what the signed-in role may see.
 * Pure, so the provider can memoise it on the same inputs it always did.
 */
export function buildOperationsContextValue({
  state,
  isHydrated,
  isDemo,
  error,
  actions,
}: OperationsContextInputs): OperationsContextValue {
  const currentAccount = state.accounts.find(
    (account) => account.id === state.session.accountId,
  ) ?? null;
  const effectiveRole = state.session.effectiveRole;
  const customerId = effectiveRole === "customer"
    ? currentAccount?.customerId ?? state.customers[0]?.id
    : undefined;
  const driverId = effectiveRole === "driver"
    ? currentAccount?.driverId ?? state.drivers[0]?.id
    : undefined;
  const shipments = effectiveRole === "admin"
    ? state.shipments
    : effectiveRole === "customer"
      ? state.shipments.filter((shipment) => shipment.customerId === customerId)
      : effectiveRole === "driver"
        ? state.shipments.filter((shipment) => shipment.assignedDriverId === driverId)
        : [];
  const activeShipment = shipments.find((shipment) => (
    shipment.status === "dispatched" ||
    shipment.status === "at_pickup" ||
    shipment.status === "loaded" ||
    shipment.status === "in_transit" ||
    shipment.status === "at_delivery" ||
    shipment.status === "exception"
  )) ?? null;
  const hosClock = driverId
    ? state.hosClocks.find((clock) => clock.driverId === driverId) ?? null
    : null;
  const customerRequests = effectiveRole === "admin"
    ? state.requests
    : state.requests.filter((request) => request.customerId === customerId);
  const quotes = effectiveRole === "admin"
    ? state.quotes
    : state.quotes.filter((quote) => quote.customerId === customerId);
  const currentDriver = driverId
    ? state.drivers.find((driver) => driver.id === driverId) ?? null
    : null;
  // Admins see the whole board; a driver sees only their own calendar and
  // their own settlements. A customer sees neither.
  const availabilityBlocks = effectiveRole === "admin"
    ? state.availabilityBlocks
    : driverId
      ? state.availabilityBlocks.filter((block) => block.driverId === driverId)
      : [];
  const availabilityRules = effectiveRole === "admin"
    ? state.availabilityRules
    : driverId
      ? state.availabilityRules.filter((rule) => rule.driverId === driverId)
      : [];
  const driverShifts = effectiveRole === "admin"
    ? state.driverShifts
    : driverId
      ? state.driverShifts.filter((shift) => shift.driverId === driverId)
      : [];
  const shiftCoverageRequests = effectiveRole === "admin"
    ? state.shiftCoverageRequests
    : driverId
      ? state.shiftCoverageRequests.filter((request) => (
        request.fromDriverId === driverId || request.targetDriverId === driverId
      ))
      : [];
  const scheduleSyncStatuses = effectiveRole === "admin"
    ? state.scheduleSyncStatuses
    : driverId
      ? state.scheduleSyncStatuses.filter((sync) => (
        state.driverShifts.some((shift) => shift.id === sync.entityId && shift.driverId === driverId)
      ))
      : [];
  const payouts = effectiveRole === "admin"
    ? state.payouts
    : driverId
      ? state.payouts.filter((payout) => payout.driverId === driverId)
      : [];
  // The fleet, the shop, and the compliance register are dispatch concerns.
  const isAdmin = effectiveRole === "admin";

  return {
    state,
    isHydrated,
    isDemo,
    currentAccount,
    effectiveRole,
    accessState: state.session.accessState ?? "active",
    accounts: state.accounts,
    shipments,
    activeShipment,
    hosClock,
    customerRequests,
    quotes,
    messages: state.messages,
    ediTransactions: state.ediTransactions,
    integrations: isAdmin ? state.integrations : [],
    currentDriver,
    vehicles: isAdmin ? state.vehicles : [],
    availabilityBlocks,
    availabilityRules,
    driverShifts,
    shiftCoverageRequests,
    scheduleSyncStatuses,
    maintenanceOrders: isAdmin ? state.maintenanceOrders : [],
    complianceDocuments: isAdmin ? state.complianceDocuments : [],
    payouts,
    error,
    actions,
  };
}
