import type {
  HydrationResult,
  OperationsRepository,
  OperationsStateListener,
} from "../domain/repository";
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
  DriverShift,
  DriverShiftInput,
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
  ScheduleSyncStatus,
  SendMessageInput,
  Shipment,
  ShipmentStatus,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
  Vehicle,
  VehicleInput,
  VehicleThumbnailSource,
} from "../domain/types";
import * as availability from "./demo/availabilityOperations";
import * as compliance from "./demo/complianceOperations";
import type { DemoWriteContext, StateUpdate } from "./demo/context";
import * as coverage from "./demo/coverageOperations";
import * as demoLoad from "./demo/demoLoad";
import * as driver from "./demo/driverOperations";
import * as exceptions from "./demo/exceptionOperations";
import * as fleet from "./demo/fleetOperations";
import { freshDemoState, hydrateDemoState } from "./demo/hydration";
import * as maintenance from "./demo/maintenanceOperations";
import * as messaging from "./demo/messagingOperations";
import * as payoutMethodOperations from "./demo/payoutMethodOperations";
import * as proof from "./demo/proofOperations";
import * as session from "./demo/sessionOperations";
import * as shifts from "./demo/shiftOperations";
import * as shipments from "./demo/shipmentOperations";
import * as settlements from "./demo/settlementOperations";
import * as stops from "./demo/stopOperations";
import { normalizedIsoDateTime } from "./demo/validation";
import { PayoutMethodStore } from "./payoutMethodStore";
import { AsyncStoragePersistenceAdapter, type PersistenceAdapter } from "./persistence";
import { serializeDemoOperationsState } from "./stateSchema";

export interface DemoOperationsRepositoryOptions {
  readonly persistence?: PersistenceAdapter;
  readonly clock?: () => string;
  /** Injected in tests so payout handles never reach a real keychain. */
  readonly payoutMethods?: PayoutMethodStore;
}

/**
 * Owns the demo's mutable state, its write queue, and its id sequence, and
 * hands each write to the operation module for that area. The behaviour lives
 * in `./demo/*`; what stays here is the state this class alone may touch.
 */
export class DemoOperationsRepository implements OperationsRepository {
  readonly mode = "demo" as const;
  private state: DemoOperationsState;
  private readonly persistence: PersistenceAdapter;
  private readonly clock: () => string;
  private readonly listeners = new Set<OperationsStateListener>();
  private operationQueue: Promise<void> = Promise.resolve();
  private idSequence = 0;
  private readonly payoutMethods: PayoutMethodStore;

  constructor(options: DemoOperationsRepositoryOptions = {}) {
    this.persistence = options.persistence ?? new AsyncStoragePersistenceAdapter();
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.payoutMethods = options.payoutMethods ?? new PayoutMethodStore({ clock: () => this.clock() });
    this.state = freshDemoState(this.clock);
  }

  hydrate(): Promise<HydrationResult> {
    return this.enqueue(async () => {
      const hydrated = await hydrateDemoState(this.state, this.persistence, this.clock);
      // An unchanged state means nothing was restored, so there is nothing to
      // publish to the listeners.
      if (hydrated.state !== this.state) {
        this.state = hydrated.state;
        this.notify();
      }
      return { state: this.state, recoveryFailure: hydrated.recoveryFailure };
    });
  }

  getState(): DemoOperationsState {
    return this.state;
  }

  subscribe(listener: OperationsStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  signIn(email: string, pin: string): Promise<DemoOperationsState> {
    return this.commit((context) => session.signIn(context, email, pin));
  }

  signOut(): Promise<DemoOperationsState> {
    return this.commit((context) => session.signOut(context));
  }

  switchDemoRole(role: AppRole): Promise<DemoOperationsState> {
    return this.commit((context) => session.switchDemoRole(context, role));
  }

  resetDemo(): Promise<DemoOperationsState> {
    return this.enqueue(async () => {
      const resetState = freshDemoState(this.clock);
      await this.persistence.write(serializeDemoOperationsState(resetState));
      this.state = resetState;
      this.idSequence = 0;
      this.notify();
      return this.state;
    });
  }

  respondToTender(
    shipmentId: EntityId,
    response: "accepted" | "declined",
  ): Promise<Shipment> {
    return this.commit((context) => shipments.respondToTender(context, shipmentId, response));
  }

  assignShipment(
    shipmentId: EntityId,
    driverId: EntityId,
    offerPriceCents?: number,
  ): Promise<Shipment> {
    return this.commit((context) => shipments.assignShipment(context, shipmentId, driverId, offerPriceCents));
  }

  addDemoUnassignedLoad(): Promise<Shipment> {
    return this.commit((context) => demoLoad.addDemoUnassignedLoad(context));
  }

  transitionShipment(
    shipmentId: EntityId,
    nextStatus: ShipmentStatus,
    stopId?: EntityId,
  ): Promise<Shipment> {
    return this.commit((context) => shipments.transitionShipment(context, shipmentId, nextStatus, stopId));
  }

  advanceIntermediateStop(shipmentId: EntityId, stopId: EntityId): Promise<Shipment> {
    return this.commit((context) => stops.advanceIntermediateStop(context, shipmentId, stopId));
  }

  transitionDutyStatus(nextStatus: HosDutyStatus): Promise<DemoOperationsState> {
    return this.commit((context) => driver.transitionDutyStatus(context, nextStatus));
  }

  recordDriverLocation(coordinates: GeoPoint): Promise<DemoOperationsState> {
    return this.commit((context) => driver.recordDriverLocation(context, coordinates));
  }

  reportException(
    shipmentId: EntityId,
    input: ExceptionReportInput,
  ): Promise<ExceptionReport> {
    return this.commit((context) => exceptions.reportException(context, shipmentId, input));
  }

  resolveException(
    exceptionId: EntityId,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<ExceptionReport> {
    return this.commit((context) => exceptions.resolveException(context, exceptionId, resolutionNote, resumeStatus));
  }

  submitProofOfDelivery(
    shipmentId: EntityId,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    return this.commit((context) => proof.submitProofOfDelivery(context, shipmentId, input));
  }

  sendMessage(input: SendMessageInput): Promise<OperationsMessage> {
    return this.commit((context) => messaging.sendMessage(context, input));
  }

  createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest> {
    return this.commit((context) => messaging.createCustomerRequest(context, input));
  }

  markMessageRead(messageId: EntityId): Promise<OperationsMessage> {
    return this.commit((context) => messaging.markMessageRead(context, messageId));
  }

  getShipmentEdiTransactions(shipmentId: EntityId): readonly EdiTransaction[] {
    return this.state.ediTransactions.filter((transaction) => transaction.shipmentId === shipmentId);
  }

  setAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock> {
    return this.commit((context) => availability.setAvailabilityBlock(context, input));
  }

  removeAvailabilityBlock(blockId: EntityId): Promise<DemoOperationsState> {
    return this.commit((context) => availability.removeAvailabilityBlock(context, blockId));
  }

  setAvailabilityRule(input: AvailabilityRuleInput): Promise<AvailabilityRule> {
    return this.commit((context) => availability.setAvailabilityRule(context, input));
  }

  removeAvailabilityRule(ruleId: EntityId): Promise<DemoOperationsState> {
    return this.commit((context) => availability.removeAvailabilityRule(context, ruleId));
  }

  setDriverShift(input: DriverShiftInput): Promise<DriverShift> {
    return this.commit((context) => shifts.setDriverShift(context, input));
  }

  removeDriverShift(shiftId: EntityId): Promise<DemoOperationsState> {
    return this.commit((context) => shifts.removeDriverShift(context, shiftId));
  }

  requestShiftCoverage(input: ShiftCoverageRequestInput): Promise<ShiftCoverageRequest> {
    return this.commit((context) => coverage.requestShiftCoverage(context, input));
  }

  respondToShiftCoverage(
    requestId: EntityId,
    response: "accepted" | "declined",
  ): Promise<ShiftCoverageRequest> {
    return this.commit((context) => coverage.respondToShiftCoverage(context, requestId, response));
  }

  retryScheduleSync(shiftId: EntityId): Promise<ScheduleSyncStatus> {
    return this.commit((context) => shifts.retryScheduleSync(context, shiftId));
  }

  listPayoutMethods(): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => payoutMethodOperations.listPayoutMethods(this.state, this.payoutMethods));
  }

  savePayoutMethod(input: PayoutMethodInput): Promise<PayoutMethod> {
    return this.enqueue(async () => payoutMethodOperations.savePayoutMethod(this.state, this.payoutMethods, input));
  }

  removePayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => payoutMethodOperations.removePayoutMethod(this.state, this.payoutMethods, methodId));
  }

  setDefaultPayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => payoutMethodOperations.setDefaultPayoutMethod(this.state, this.payoutMethods, methodId));
  }

  upsertVehicle(input: VehicleInput): Promise<Vehicle> {
    return this.commit((context) => fleet.upsertVehicle(context, input));
  }

  assignVehicle(vehicleId: EntityId, driverId: EntityId | null): Promise<Vehicle> {
    return this.commit((context) => fleet.assignVehicle(context, vehicleId, driverId));
  }

  transferVehicle(vehicleId: EntityId, targetDriverId: EntityId, note: string): Promise<Vehicle> {
    return this.commit((context) => fleet.transferVehicle(context, vehicleId, targetDriverId, note));
  }

  updateVehicleThumbnail(vehicleId: EntityId, source: VehicleThumbnailSource): Promise<Vehicle> {
    return this.commit((context) => fleet.updateVehicleThumbnail(context, vehicleId, source));
  }

  createMaintenanceOrder(input: MaintenanceOrderInput): Promise<MaintenanceOrder> {
    return this.commit((context) => maintenance.createMaintenanceOrder(context, input));
  }

  updateMaintenanceOrder(
    orderId: EntityId,
    patch: MaintenanceOrderPatch,
  ): Promise<MaintenanceOrder> {
    return this.commit((context) => maintenance.updateMaintenanceOrder(context, orderId, patch));
  }

  upsertComplianceDocument(input: ComplianceDocumentInput): Promise<ComplianceDocument> {
    return this.commit((context) => compliance.upsertComplianceDocument(context, input));
  }

  issuePayout(
    driverId: EntityId,
    periodStart: IsoDateTime,
    periodEnd: IsoDateTime,
  ): Promise<Payout> {
    return this.commit((context) => settlements.issuePayout(context, driverId, periodStart, periodEnd));
  }

  markPayoutPaid(payoutId: EntityId, rail: PayoutRail): Promise<Payout> {
    return this.commit((context) => settlements.markPayoutPaid(context, payoutId, rail));
  }

  private commit<Result>(
    update: (context: DemoWriteContext) => StateUpdate<Result>,
  ): Promise<Result> {
    return this.enqueue(async () => {
      const occurredAt = normalizedIsoDateTime(this.clock());
      const next = update({
        state: this.state,
        occurredAt,
        nextId: (prefix) => this.nextId(prefix, occurredAt),
      });
      await this.persistence.write(serializeDemoOperationsState(next.state));
      this.state = next.state;
      this.notify();
      return next.result;
    });
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private nextId(prefix: string, occurredAt: string): string {
    this.idSequence += 1;
    return `${prefix}-${Date.parse(occurredAt)}-${this.idSequence}`;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
