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
  AppRole,
  CreateCustomerRequestInput,
  CustomerRequest,
  DemoOperationsState,
  EdiTransaction,
  Equipment,
  ExceptionReportInput,
  FreightQuote,
  GeoPoint,
  HosClock,
  HosDutyStatus,
  IntegrationHealth,
  OperationsMessage,
  OperationsAccount,
  ProofOfDeliveryInput,
  SendMessageInput,
  Shipment,
  ShipmentStatus,
} from "../domain/types";
import { createOperationsRepositoryFromEnvironment } from "./repositoryFactory";

export interface OperationsActions {
  signIn(email: string, pin: string): Promise<boolean>;
  restoreSession(): Promise<boolean>;
  signOut(): Promise<boolean>;
  switchDemoRole(role: AppRole): Promise<boolean>;
  resetDemo(): Promise<boolean>;
  respondToTender(shipmentId: string, response: "accepted" | "declined"): Promise<boolean>;
  assignShipment(
    shipmentId: string,
    driverId: string,
    tractorId?: string,
    trailerId?: string,
  ): Promise<boolean>;
  transitionShipment(
    shipmentId: string,
    nextStatus: ShipmentStatus,
    stopId?: string,
  ): Promise<boolean>;
  advanceIntermediateStop(shipmentId: string, stopId: string): Promise<boolean>;
  transitionDutyStatus(nextStatus: HosDutyStatus): Promise<boolean>;
  simulateDriverLocation(coordinates: GeoPoint): Promise<boolean>;
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
  clearError(): void;
}

export interface OperationsContextValue {
  readonly state: DemoOperationsState;
  readonly isHydrated: boolean;
  readonly currentAccount: OperationsAccount | null;
  readonly effectiveRole: AppRole | null;
  readonly accounts: readonly OperationsAccount[];
  readonly shipments: readonly Shipment[];
  readonly activeShipment: Shipment | null;
  readonly hosClock: HosClock | null;
  readonly customerRequests: readonly CustomerRequest[];
  readonly quotes: readonly FreightQuote[];
  readonly equipment: readonly Equipment[];
  readonly messages: readonly OperationsMessage[];
  readonly ediTransactions: readonly EdiTransaction[];
  readonly integrations: readonly IntegrationHealth[];
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
      assignShipment: (shipmentId, driverId, tractorId, trailerId) => runMutation(
        () => repository.assignShipment(shipmentId, driverId, tractorId, trailerId),
      ),
      transitionShipment: (shipmentId, nextStatus, stopId) => runMutation(
        () => repository.transitionShipment(shipmentId, nextStatus, stopId),
      ),
      advanceIntermediateStop: (shipmentId, stopId) => runMutation(
        () => repository.advanceIntermediateStop(shipmentId, stopId),
      ),
      transitionDutyStatus: (nextStatus) => runMutation(
        () => repository.transitionDutyStatus(nextStatus),
      ),
      simulateDriverLocation: (coordinates) => runMutation(
        () => repository.simulateDriverLocation(coordinates),
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

    return {
      state,
      isHydrated,
      currentAccount,
      effectiveRole,
      accounts: state.accounts,
      shipments,
      activeShipment,
      hosClock,
      customerRequests,
      quotes,
      equipment: state.equipment,
      messages: state.messages,
      ediTransactions: state.ediTransactions,
      integrations: state.integrations,
      error,
      actions,
    };
  }, [actions, error, isHydrated, state]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) {
    throw new Error("useOperations must be used inside an OperationsProvider.");
  }
  return value;
}
