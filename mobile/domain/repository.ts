import type { OperationsFailure } from "./errors";
import type {
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
  EdiTransaction,
  EntityId,
  ExceptionReport,
  ExceptionReportInput,
  GeoPoint,
  HosDutyStatus,
  IsoDateTime,
  MaintenanceOrder,
  MaintenanceOrderInput,
  MaintenanceOrderPatch,
  OperationsMessage,
  Payout,
  PayoutMethod,
  PayoutMethodInput,
  PayoutRail,
  ProofOfDelivery,
  ProofOfDeliveryInput,
  SendMessageInput,
  Shipment,
  ShipmentStatus,
  DriverShift,
  DriverShiftInput,
  ScheduleSyncStatus,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
  Vehicle,
  VehicleInput,
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
  assignShipment(shipmentId: EntityId, driverId: EntityId): Promise<Shipment>;
  /** Adds a local sample load; production repositories intentionally reject it. */
  addDemoUnassignedLoad(): Promise<Shipment>;
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

  /**
   * Availability. A driver writes their own calendar; an admin may write any
   * driver's by naming one in the input.
   */
  setAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock>;
  removeAvailabilityBlock(blockId: EntityId): Promise<DemoOperationsState>;
  setAvailabilityRule(input: AvailabilityRuleInput): Promise<AvailabilityRule>;
  removeAvailabilityRule(ruleId: EntityId): Promise<DemoOperationsState>;
  setDriverShift(input: DriverShiftInput): Promise<DriverShift>;
  removeDriverShift(shiftId: EntityId): Promise<DemoOperationsState>;
  requestShiftCoverage(input: ShiftCoverageRequestInput): Promise<ShiftCoverageRequest>;
  respondToShiftCoverage(
    requestId: EntityId,
    response: "accepted" | "declined",
  ): Promise<ShiftCoverageRequest>;
  retryScheduleSync(shiftId: EntityId): Promise<ScheduleSyncStatus>;

  /**
   * Payout handles. These never enter `OperationsState`; they are held in the
   * device keychain and are readable only by the driver who owns them.
   */
  listPayoutMethods(): Promise<readonly PayoutMethod[]>;
  savePayoutMethod(input: PayoutMethodInput): Promise<PayoutMethod>;
  removePayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]>;
  setDefaultPayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]>;

  /** Fleet, shop, and compliance. Admin only. */
  upsertVehicle(input: VehicleInput): Promise<Vehicle>;
  assignVehicle(vehicleId: EntityId, driverId: EntityId | null): Promise<Vehicle>;
  createMaintenanceOrder(input: MaintenanceOrderInput): Promise<MaintenanceOrder>;
  updateMaintenanceOrder(
    orderId: EntityId,
    patch: MaintenanceOrderPatch,
  ): Promise<MaintenanceOrder>;
  upsertComplianceDocument(input: ComplianceDocumentInput): Promise<ComplianceDocument>;

  /**
   * Settlements. `markPayoutPaid` records that a transfer happened on the
   * named rail; it does not initiate one.
   */
  issuePayout(
    driverId: EntityId,
    periodStart: IsoDateTime,
    periodEnd: IsoDateTime,
  ): Promise<Payout>;
  markPayoutPaid(payoutId: EntityId, rail: PayoutRail): Promise<Payout>;
}
