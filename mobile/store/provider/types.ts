import type { ReactNode } from "react";

import type { OperationsFailure } from "../../domain/errors";
import type { OperationsRepository } from "../../domain/repository";
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
  VehicleThumbnailSource,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
} from "../../domain/types";

export interface OperationsActions {
  signIn(email: string, pin: string): Promise<boolean>;
  restoreSession(): Promise<boolean>;
  signOut(): Promise<boolean>;
  switchDemoRole(role: AppRole): Promise<boolean>;
  resetDemo(): Promise<boolean>;
  respondToTender(shipmentId: string, response: "accepted" | "declined"): Promise<boolean>;
  assignShipment(shipmentId: string, driverId: string, offerPriceCents?: number): Promise<boolean>;
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
  transferVehicle(vehicleId: string, targetDriverId: string, note: string): Promise<boolean>;
  updateVehicleThumbnail(vehicleId: string, source: VehicleThumbnailSource): Promise<boolean>;
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
