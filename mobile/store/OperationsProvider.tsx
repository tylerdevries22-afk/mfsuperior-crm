import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { toOperationsFailure, type OperationsFailure } from "../domain/errors";
import { createDemoOperationsState } from "../domain/fixtures";
import type { OperationsRepository } from "../domain/repository";
import type {
  AccessState,
  AppRole,
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilityRule,
  AvailabilityRuleInput,
  ComplianceDocument,
  ComplianceDocumentInput,
  CreateCustomerRequestInput,
  CustomerRequest,
  DemoOperationsState,
  Driver,
  DriverShift,
  DriverShiftInput,
  EdiTransaction,
  ExceptionReportInput,
  FreightQuote,
  GeoPoint,
  HosClock,
  HosDutyStatus,
  IntegrationHealth,
  MaintenanceOrder,
  MaintenanceOrderInput,
  MaintenanceOrderPatch,
  OperationsMessage,
  OperationsAccount,
  Payout,
  PayoutMethod,
  PayoutMethodInput,
  PayoutRail,
  ProofOfDeliveryInput,
  SendMessageInput,
  ScheduleSyncStatus,
  Shipment,
  ShipmentStatus,
  Vehicle,
  VehicleInput,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
} from "../domain/types";
import { createOperationsRepositoryFromEnvironment } from "./repositoryFactory";

export interface OperationsActions {
  signIn(email: string, pin: string): Promise<boolean>;
  restoreSession(): Promise<boolean>;
  signOut(): Promise<boolean>;
  switchDemoRole(role: AppRole): Promise<boolean>;
  resetDemo(): Promise<boolean>;
  respondToTender(shipmentId: string, response: "accepted" | "declined"): Promise<boolean>;
  assignShipment(shipmentId: string, driverId: string): Promise<boolean>;
  addDemoUnassignedLoad(): Promise<boolean>;
  transitionShipment(
    shipmentId: string,
    nextStatus: ShipmentStatus,
    stopId?: string,
  ): Promise<boolean>;
  advanceIntermediateStop(shipmentId: string, stopId: string): Promise<boolean>;
  transitionDutyStatus(nextStatus: HosDutyStatus): Promise<boolean>;
  recordDriverLocation(coordinates: GeoPoint): Promise<boolean>;
  reportException(shipmentId: string, input: ExceptionReportInput): Promise<boolean>;
  resolveException(
    exceptionId: string,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<boolean>;
  submitProofOfDelivery(shipmentId: string, input: ProofOfDeliveryInput): Promise<boolean>;
  sendMessage(input: SendMessageInput): Promise<boolean>;
  createCustomerRequest(input: CreateCustomerRequestInput): Promise<boolean>;
  markMessageRead(messageId: string): Promise<boolean>;
  setAvailabilityBlock(input: AvailabilityBlockInput): Promise<boolean>;
  removeAvailabilityBlock(blockId: string): Promise<boolean>;
  setAvailabilityRule(input: AvailabilityRuleInput): Promise<boolean>;
  removeAvailabilityRule(ruleId: string): Promise<boolean>;
  setDriverShift(input: DriverShiftInput): Promise<boolean>;
  removeDriverShift(shiftId: string): Promise<boolean>;
  requestShiftCoverage(input: ShiftCoverageRequestInput): Promise<boolean>;
  respondToShiftCoverage(requestId: string, response: "accepted" | "declined"): Promise<boolean>;
  retryScheduleSync(shiftId: string): Promise<boolean>;
  upsertVehicle(input: VehicleInput): Promise<boolean>;
  assignVehicle(vehicleId: string, driverId: string | null): Promise<boolean>;
  createMaintenanceOrder(input: MaintenanceOrderInput): Promise<boolean>;
  updateMaintenanceOrder(orderId: string, patch: MaintenanceOrderPatch): Promise<boolean>;
  upsertComplianceDocument(input: ComplianceDocumentInput): Promise<boolean>;
  issuePayout(driverId: string, periodStart: string, periodEnd: string): Promise<boolean>;
  markPayoutPaid(payoutId: string, rail: PayoutRail): Promise<boolean>;
  /**
   * Payout handles are read straight off the repository rather than mirrored
   * into context, because they live in the device keychain and must not end up
   * in a value every screen in the tree can read.
   */
  listPayoutMethods(): Promise<readonly PayoutMethod[]>;
  savePayoutMethod(input: PayoutMethodInput): Promise<boolean>;
  removePayoutMethod(methodId: string): Promise<boolean>;
  setDefaultPayoutMethod(methodId: string): Promise<boolean>;
  clearError(): void;
}

export interface OperationsContextValue {
  readonly state: DemoOperationsState;
  readonly isHydrated: boolean;
  readonly isDemo: boolean;
  readonly currentAccount: OperationsAccount | null;
  readonly effectiveRole: AppRole | null;
  readonly accessState: AccessState;
  readonly accounts: readonly OperationsAccount[];
  readonly shipments: readonly Shipment[];
  readonly activeShipment: Shipment | null;
  readonly hosClock: HosClock | null;
  readonly customerRequests: readonly CustomerRequest[];
  readonly quotes: readonly FreightQuote[];
  readonly messages: readonly OperationsMessage[];
  readonly ediTransactions: readonly EdiTransaction[];
  readonly integrations: readonly IntegrationHealth[];
  /** The signed-in driver's own record, when a driver is signed in. */
  readonly currentDriver: Driver | null;
  readonly vehicles: readonly Vehicle[];
  readonly availabilityBlocks: readonly AvailabilityBlock[];
  readonly availabilityRules: readonly AvailabilityRule[];
  readonly driverShifts: readonly DriverShift[];
  readonly shiftCoverageRequests: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses: readonly ScheduleSyncStatus[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly complianceDocuments: readonly ComplianceDocument[];
  readonly payouts: readonly Payout[];
  readonly error: OperationsFailure | null;
  readonly actions: OperationsActions;
}

export interface OperationsProviderProps {
  readonly children: ReactNode;
  readonly repository?: OperationsRepository;
}

const defaultRepository = createOperationsRepositoryFromEnvironment();
const OperationsContext = createContext<OperationsContextValue | null>(null);

export function OperationsProvider({
  children,
  repository = defaultRepository,
}: OperationsProviderProps) {
  const [state, setState] = useState<DemoOperationsState>(() => repository.getState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<OperationsFailure | null>(null);

  useEffect(() => {
    let isActive = true;
    const unsubscribe = repository.subscribe((nextState) => {
      if (isActive) {
        setState(nextState);
      }
    });

    repository.hydrate().then(
      (result) => {
        if (!isActive) {
          return;
        }
        setState(result.state);
        setError(result.recoveryFailure);
        setIsHydrated(true);
      },
      (hydrationError: unknown) => {
        if (!isActive) {
          return;
        }
        setState(createDemoOperationsState());
        setError(toOperationsFailure(hydrationError));
        setIsHydrated(true);
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [repository]);

  const actions = useMemo<OperationsActions>(() => {
    const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
      setError(null);
      try {
        await mutation();
        return true;
      } catch (mutationError: unknown) {
        setError(toOperationsFailure(mutationError));
        return false;
      }
    };

    return {
      signIn: (email, pin) => runMutation(() => repository.signIn(email, pin)),
      restoreSession: () => runMutation(() => repository.hydrate()),
      signOut: () => runMutation(() => repository.signOut()),
      switchDemoRole: (role) => runMutation(() => repository.switchDemoRole(role)),
      resetDemo: () => runMutation(() => repository.resetDemo()),
      respondToTender: (shipmentId, response) => runMutation(
        () => repository.respondToTender(shipmentId, response),
      ),
      assignShipment: (shipmentId, driverId) => runMutation(
        () => repository.assignShipment(shipmentId, driverId),
      ),
      addDemoUnassignedLoad: () => runMutation(() => repository.addDemoUnassignedLoad()),
      transitionShipment: (shipmentId, nextStatus, stopId) => runMutation(
        () => repository.transitionShipment(shipmentId, nextStatus, stopId),
      ),
      advanceIntermediateStop: (shipmentId, stopId) => runMutation(
        () => repository.advanceIntermediateStop(shipmentId, stopId),
      ),
      transitionDutyStatus: (nextStatus) => runMutation(
        () => repository.transitionDutyStatus(nextStatus),
      ),
      recordDriverLocation: (coordinates) => runMutation(
        () => repository.recordDriverLocation(coordinates),
      ),
      reportException: (shipmentId, input) => runMutation(
        () => repository.reportException(shipmentId, input),
      ),
      resolveException: (exceptionId, resolutionNote, resumeStatus) => runMutation(
        () => repository.resolveException(exceptionId, resolutionNote, resumeStatus),
      ),
      submitProofOfDelivery: (shipmentId, input) => runMutation(
        () => repository.submitProofOfDelivery(shipmentId, input),
      ),
      sendMessage: (input) => runMutation(() => repository.sendMessage(input)),
      createCustomerRequest: (input) => runMutation(
        () => repository.createCustomerRequest(input),
      ),
      markMessageRead: (messageId) => runMutation(() => repository.markMessageRead(messageId)),
      setAvailabilityBlock: (input) => runMutation(() => repository.setAvailabilityBlock(input)),
      removeAvailabilityBlock: (blockId) => runMutation(
        () => repository.removeAvailabilityBlock(blockId),
      ),
      setAvailabilityRule: (input) => runMutation(() => repository.setAvailabilityRule(input)),
      removeAvailabilityRule: (ruleId) => runMutation(
        () => repository.removeAvailabilityRule(ruleId),
      ),
      setDriverShift: (input) => runMutation(() => repository.setDriverShift(input)),
      removeDriverShift: (shiftId) => runMutation(() => repository.removeDriverShift(shiftId)),
      requestShiftCoverage: (input) => runMutation(
        () => repository.requestShiftCoverage(input),
      ),
      respondToShiftCoverage: (requestId, response) => runMutation(
        () => repository.respondToShiftCoverage(requestId, response),
      ),
      retryScheduleSync: (shiftId) => runMutation(() => repository.retryScheduleSync(shiftId)),
      upsertVehicle: (input) => runMutation(() => repository.upsertVehicle(input)),
      assignVehicle: (vehicleId, driverId) => runMutation(
        () => repository.assignVehicle(vehicleId, driverId),
      ),
      createMaintenanceOrder: (input) => runMutation(
        () => repository.createMaintenanceOrder(input),
      ),
      updateMaintenanceOrder: (orderId, patch) => runMutation(
        () => repository.updateMaintenanceOrder(orderId, patch),
      ),
      upsertComplianceDocument: (input) => runMutation(
        () => repository.upsertComplianceDocument(input),
      ),
      issuePayout: (driverId, periodStart, periodEnd) => runMutation(
        () => repository.issuePayout(driverId, periodStart, periodEnd),
      ),
      markPayoutPaid: (payoutId, rail) => runMutation(
        () => repository.markPayoutPaid(payoutId, rail),
      ),
      // A read, so it surfaces its own failure to the caller rather than
      // routing through runMutation, which only reports success as a boolean.
      listPayoutMethods: async () => {
        try {
          return await repository.listPayoutMethods();
        } catch (readError: unknown) {
          setError(toOperationsFailure(readError));
          return [];
        }
      },
      savePayoutMethod: (input) => runMutation(() => repository.savePayoutMethod(input)),
      removePayoutMethod: (methodId) => runMutation(() => repository.removePayoutMethod(methodId)),
      setDefaultPayoutMethod: (methodId) => runMutation(
        () => repository.setDefaultPayoutMethod(methodId),
      ),
      clearError: () => setError(null),
    };
  }, [repository]);

  const value = useMemo<OperationsContextValue>(() => {
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
      isDemo: repository.mode === "demo",
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
  }, [actions, error, isHydrated, repository.mode, state]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) {
    throw new Error("useOperations must be used inside an OperationsProvider.");
  }
  return value;
}

/** For shared chrome that can also render in isolated previews and tests. */
export function useOptionalOperations(): OperationsContextValue | null {
  return useContext(OperationsContext);
}
