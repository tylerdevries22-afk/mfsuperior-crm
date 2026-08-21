import type { OperationsFailure } from "./errors";
import type {
  AppRole,
  CreateCustomerRequestInput,
  CustomerRequest,
  DemoOperationsState,
  EdiTransaction,
  EntityId,
  ExceptionReport,
  ExceptionReportInput,
  GeoPoint,
  HosDutyStatus,
  OperationsMessage,
  ProofOfDelivery,
  ProofOfDeliveryInput,
  SendMessageInput,
  Shipment,
  ShipmentStatus,
} from "./types";

export interface HydrationResult {
  readonly state: DemoOperationsState;
  readonly recoveryFailure: OperationsFailure | null;
}

export type OperationsStateListener = (state: DemoOperationsState) => void;

export interface OperationsRepository {
  readonly mode: "demo" | "production" | "unconfigured";
  hydrate(): Promise<HydrationResult>;
  getState(): DemoOperationsState;
  subscribe(listener: OperationsStateListener): () => void;
  signIn(email: string, credential: string): Promise<DemoOperationsState>;
  signOut(): Promise<DemoOperationsState>;
  switchDemoRole(role: AppRole): Promise<DemoOperationsState>;
  resetDemo(): Promise<DemoOperationsState>;
  respondToTender(
    shipmentId: EntityId,
    response: "accepted" | "declined",
  ): Promise<Shipment>;
  assignShipment(
    shipmentId: EntityId,
    driverId: EntityId,
    tractorId?: EntityId,
    trailerId?: EntityId,
  ): Promise<Shipment>;
  transitionShipment(
    shipmentId: EntityId,
    nextStatus: ShipmentStatus,
    stopId?: EntityId,
  ): Promise<Shipment>;
  advanceIntermediateStop(shipmentId: EntityId, stopId: EntityId): Promise<Shipment>;
  transitionDutyStatus(nextStatus: HosDutyStatus): Promise<DemoOperationsState>;
  recordDriverLocation(coordinates: GeoPoint): Promise<DemoOperationsState>;
  reportException(shipmentId: EntityId, input: ExceptionReportInput): Promise<ExceptionReport>;
  resolveException(
    exceptionId: EntityId,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<ExceptionReport>;
  submitProofOfDelivery(
    shipmentId: EntityId,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery>;
  sendMessage(input: SendMessageInput): Promise<OperationsMessage>;
  createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest>;
  markMessageRead(messageId: EntityId): Promise<OperationsMessage>;
  getShipmentEdiTransactions(shipmentId: EntityId): readonly EdiTransaction[];
}
