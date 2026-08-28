import { randomUUID } from "expo-crypto";

import { OperationsDomainError } from "../domain/errors";
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
  FreightRequestLocationInput,
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
  ScheduleSyncStatus,
  Shipment,
  ShipmentStatus,
  ShiftCoverageRequest,
  ShiftCoverageRequestInput,
  Vehicle,
  VehicleInput,
  VehicleThumbnailSource,
} from "../domain/types";
import { DEMO_STATE_VERSION } from "../domain/types";
import { normalizePayoutHandle } from "./payoutMethodStore";
import type { AuthIdentity } from "../lib/auth";
import {
  ApiClient,
  NetworkRequestError,
  readUploadBody,
  uploadToSignedUrl,
  type UploadIntentResponse,
  type UploadSource,
} from "../lib/network";
import {
  OfflineMutationQueue,
  toMutationOperation,
  type OfflineMutation,
  type OfflineMutationDraft,
  type OfflineQueueHooks,
} from "../lib/offline";
import { isDemoOperationsState } from "./stateSchema";
import {
  buildPendingCustomerOperationsState,
  buildProductionOperationsState,
  type MobileBootstrapPayload,
  type MobileExceptionRow,
  type MobileFreightRequestRow,
  type MobileMessageRow,
  type MobileShipmentRow,
} from "./productionStateAdapter";

export interface ProductionAuthGateway {
  getCurrentIdentity(): Promise<AuthIdentity | null>;
  signIn(email: string, password: string): Promise<AuthIdentity>;
  signOut(): Promise<void>;
}

export interface ProductionOperationsRepositoryOptions {
  readonly apiClient: ApiClient;
  readonly auth: ProductionAuthGateway;
  readonly clock?: () => string;
  readonly fetchImplementation?: typeof fetch;
  readonly idFactory?: () => string;
  readonly offlineQueue: OfflineMutationQueue;
  readonly queueHooks?: OfflineQueueHooks;
  readonly uploadBaseUrl?: string;
}

/** The collections a mutation may ask `refreshState` to re-read. */
interface ExtendedCollections {
  readonly availabilityBlocks: readonly AvailabilityBlock[];
  readonly availabilityRules: readonly AvailabilityRule[];
  readonly driverShifts: readonly DriverShift[];
  readonly shiftCoverageRequests: readonly ShiftCoverageRequest[];
  readonly scheduleSyncStatuses: readonly ScheduleSyncStatus[];
  readonly complianceDocuments: readonly ComplianceDocument[];
  readonly maintenanceOrders: readonly MaintenanceOrder[];
  readonly payouts: readonly Payout[];
  readonly vehicles: readonly Vehicle[];
}

type ExtendedRefresh = "all" | "cached" | readonly (keyof ExtendedCollections)[];

interface VehicleThumbnailUploadIntent {
  readonly path: string;
  readonly upload: {
    readonly contentType: string;
    readonly expiresAt: string;
    readonly token: string;
    readonly url: string;
  };
}

const EMPTY_EXTENDED: ExtendedCollections = {
  availabilityBlocks: [],
  availabilityRules: [],
  driverShifts: [],
  shiftCoverageRequests: [],
  scheduleSyncStatuses: [],
  complianceDocuments: [],
  maintenanceOrders: [],
  payouts: [],
  vehicles: [],
};

export class ProductionOperationsRepository implements OperationsRepository {
  readonly mode = "production" as const;
  private readonly apiClient: ApiClient;
  private readonly auth: ProductionAuthGateway;
  private readonly clock: () => string;
  private readonly fetchImplementation: typeof fetch;
  private readonly idFactory: () => string;
  private readonly listeners = new Set<OperationsStateListener>();
  private readonly offlineQueue: OfflineMutationQueue;
  private readonly queueHooks: OfflineQueueHooks;
  private readonly uploadBaseUrl: string | undefined;
  private identity: AuthIdentity | null = null;
  private extendedCollections: ExtendedCollections = EMPTY_EXTENDED;
  private state: DemoOperationsState;

  constructor(options: ProductionOperationsRepositoryOptions) {
    this.apiClient = options.apiClient;
    this.auth = options.auth;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.idFactory = options.idFactory ?? randomUUID;
    this.offlineQueue = options.offlineQueue;
    this.queueHooks = options.queueHooks ?? {};
    this.uploadBaseUrl = options.uploadBaseUrl;
    this.state = createEmptyOperationsState(this.clock());
  }

  async hydrate(): Promise<HydrationResult> {
    this.identity = await this.auth.getCurrentIdentity();
    if (!this.identity) {
      this.replaceState(createEmptyOperationsState(this.clock()));
      return { recoveryFailure: null, state: this.state };
    }
    await this.refreshState("all");
    await this.syncOfflineMutations();
    return { recoveryFailure: null, state: this.state };
  }

  getState(): DemoOperationsState {
    return this.state;
  }

  subscribe(listener: OperationsStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<DemoOperationsState> {
    this.identity = await this.auth.signIn(email, password);
    await this.refreshState();
    await this.syncOfflineMutations();
    return this.state;
  }

  async signOut(): Promise<DemoOperationsState> {
    const userId = this.identity?.userId ?? null;
    try {
      await this.auth.signOut();
    } finally {
      await this.offlineQueue.purgeForLogout(userId);
      this.identity = null;
      this.replaceState(createEmptyOperationsState(this.clock()));
    }
    return this.state;
  }

  async switchDemoRole(_role: AppRole): Promise<DemoOperationsState> {
    throw productionOnlyError("Role previews are only available in the explicit demo.");
  }

  async resetDemo(): Promise<DemoOperationsState> {
    throw productionOnlyError("Demo reset is only available in the explicit demo.");
  }

  async respondToTender(
    shipmentId: EntityId,
    response: "accepted" | "declined",
  ): Promise<Shipment> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shipments/${encodeId(shipmentId)}/tender-response`,
      { response },
    );
    return this.requireShipment(shipmentId);
  }

  async assignShipment(
    shipmentId: EntityId,
    driverId: EntityId,
    offerPriceCents?: number,
  ): Promise<Shipment> {
    await this.performMutation<{ readonly driverId: string }>(
      `v1/shipments/${encodeId(shipmentId)}/assignment`,
      { driverId, offerPriceCents },
    );
    return this.requireShipment(shipmentId);
  }

  async addDemoUnassignedLoad(): Promise<Shipment> {
    throw productionOnlyError("Adding demo loads is only available in the explicit demo.");
  }

  async transitionShipment(
    shipmentId: EntityId,
    nextStatus: ShipmentStatus,
    stopId?: EntityId,
  ): Promise<Shipment> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "shipment_status",
      ownerUserId: identity.userId,
      payload: stopId ? { status: nextStatus, stopId } : { status: nextStatus },
      shipmentId,
    });
    const transitioned: Shipment = { ...shipment, status: nextStatus, updatedAt: this.clock() };
    this.replaceState({
      ...this.state,
      shipments: this.state.shipments.map((candidate) => (
        candidate.id === shipmentId ? transitioned : candidate
      )),
      updatedAt: this.clock(),
    });
    return transitioned;
  }

  async advanceIntermediateStop(_shipmentId: EntityId, _stopId: EntityId): Promise<Shipment> {
    // Production shipments only carry a pickup and a delivery stop, so there is
    // no intermediate stop to advance and no server route that would accept one.
    throw productionOnlyError(
      "Intermediate stops are not part of the production shipment record yet.",
    );
  }

  async transitionDutyStatus(nextStatus: HosDutyStatus): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    const shipment = this.findActiveShipment();
    const driverId = this.requireCurrentDriverId();
    await this.enqueueAndSync({
      entityId: driverId,
      entityVersion: shipmentVersion(shipment),
      kind: "driver_status",
      ownerUserId: identity.userId,
      payload: { status: nextStatus },
      shipmentId: shipment?.id ?? `unassigned-${driverId}`,
    });
    this.replaceState(updateDutyStatus(this.state, driverId, nextStatus, this.clock()));
    return this.state;
  }

  async recordDriverLocation(coordinates: GeoPoint): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    const shipment = this.findActiveShipment();
    const driverId = this.requireCurrentDriverId();
    await this.enqueueAndSync({
      entityId: driverId,
      entityVersion: shipmentVersion(shipment),
      kind: "location",
      ownerUserId: identity.userId,
      payload: { coordinates },
      shipmentId: shipment?.id ?? `unassigned-${driverId}`,
    });
    this.replaceState(updateDriverLocation(this.state, driverId, coordinates, this.clock()));
    return this.state;
  }

  async reportException(
    shipmentId: EntityId,
    input: ExceptionReportInput,
  ): Promise<ExceptionReport> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    await this.enqueueAttachmentMutations(identity, shipment, input.attachmentUris ?? []);
    const mutation = await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "exception",
      ownerUserId: identity.userId,
      payload: { input },
      pendingFileUris: input.attachmentUris,
      shipmentId,
    });
    const report = createOptimisticException(mutation, identity.userId, input);
    this.replaceState({
      ...this.state,
      exceptions: [...this.state.exceptions, report],
      updatedAt: this.clock(),
    });
    return report;
  }

  async resolveException(
    exceptionId: EntityId,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<ExceptionReport> {
    const report = this.requireException(exceptionId);
    await this.performMutation<{ readonly id: string }>(
      `v1/exceptions/${encodeId(exceptionId)}/resolution`,
      { resolutionNote, resumeStatus: resumableStatus(resumeStatus) },
    );
    return {
      ...report,
      resolutionNote,
      resolvedAt: this.clock(),
      status: "resolved",
    };
  }

  async submitProofOfDelivery(
    shipmentId: EntityId,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    const fileUris = input.attachments?.map((attachment) => attachment.uri) ?? [];
    await this.enqueueAttachmentMutations(identity, shipment, fileUris);
    await this.enqueueSignatureMutation(identity, shipment, input.signatureData);
    const mutation = await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "pod",
      ownerUserId: identity.userId,
      payload: { input },
      pendingFileUris: fileUris,
      shipmentId,
    });
    const proof = createOptimisticProof(mutation, identity.userId, shipmentId, input);
    this.replaceState({
      ...this.state,
      proofsOfDelivery: [...this.state.proofsOfDelivery, proof],
      updatedAt: this.clock(),
    });
    return proof;
  }

  async sendMessage(input: SendMessageInput): Promise<OperationsMessage> {
    const sent = await this.performMutation<MobileMessageRow>("v1/messages", {
      body: input.body,
      recipientUserIds: [...input.recipientAccountIds],
      shipmentId: input.shipmentId ?? null,
      threadKey: input.threadId,
      threadKind: input.threadKind,
    });
    return this.requireMessage(sent.id);
  }

  async createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest> {
    if (!input.origin || !input.destination) {
      throw new OperationsDomainError(
        "VALIDATION_FAILED",
        "A freight request needs both a pickup and a delivery address.",
      );
    }
    const created = await this.performMutation<{ readonly id: string }>("v1/requests", {
      commodity: null,
      destination: toFreightLocation(input.destination),
      notes: input.details,
      origin: toFreightLocation(input.origin),
      requestType: input.type,
      shipmentId: input.shipmentId ?? null,
      subject: input.subject,
    });
    return this.requireRequest(created.id);
  }

  async markMessageRead(messageId: EntityId): Promise<OperationsMessage> {
    await this.performMutation<{ readonly id: string }>(
      `v1/messages/${encodeId(messageId)}/read`,
      {},
    );
    return this.requireMessage(messageId);
  }

  /**
   * Fleet, availability, shop, compliance, and settlement writes.
   *
   * Each posts to its versioned endpoint and then re-reads state, so the record
   * returned here is the one the server actually holds rather than an optimistic
   * local guess. Role enforcement lives on the server: `authorizeMobileRequest`
   * refuses the call before it reaches a query.
   */
  /**
   * Availability goes through the offline queue rather than posting directly.
   * A driver blocking time does it from the cab, and losing that write to a
   * dead zone would leave dispatch believing they are available. The queue
   * replays it through `v1/mutations` when signal returns.
   */
  async setAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock> {
    const identity = this.requireIdentity();
    const driverId = input.driverId ?? identity.driverId ?? "";
    await this.enqueueAndSync({
      entityId: input.id ?? `availability-${input.startsAt}`,
      entityVersion: 0,
      kind: "availability",
      ownerUserId: identity.userId,
      payload: { block: input },
      shipmentId: `availability-${driverId}`,
    });
    await this.refreshState(["availabilityBlocks"]);

    // The server assigns the id, so a block that has already synced is found by
    // its span. One still sitting in the queue has no server row yet, and is
    // reflected optimistically — the same treatment `transitionShipment` gives
    // a queued status change. Queuing is a success, not a failure to report.
    const synced = this.state.availabilityBlocks.find(
      (block) => block.driverId === driverId &&
        block.startsAt === input.startsAt &&
        block.endsAt === input.endsAt,
    );
    if (synced) {
      return synced;
    }

    const now = this.clock();
    const pending: AvailabilityBlock = {
      createdAt: now,
      driverId,
      endsAt: input.endsAt,
      id: input.id ?? `pending-availability-${Date.parse(input.startsAt)}`,
      kind: input.kind,
      note: input.note,
      startsAt: input.startsAt,
      updatedAt: now,
    };
    this.replaceState({
      ...this.state,
      availabilityBlocks: [
        ...this.state.availabilityBlocks.filter((block) => block.id !== pending.id),
        pending,
      ],
      updatedAt: now,
    });
    return pending;
  }

  async removeAvailabilityBlock(blockId: EntityId): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    await this.enqueueAndSync({
      entityId: blockId,
      entityVersion: 0,
      kind: "availability_removal",
      ownerUserId: identity.userId,
      payload: { blockId },
      shipmentId: `availability-${identity.driverId ?? identity.userId}`,
    });
    // Dropped locally first, so the calendar does not keep showing a block the
    // driver just deleted while the queue drains.
    this.replaceState({
      ...this.state,
      availabilityBlocks: this.state.availabilityBlocks.filter(
        (block) => block.id !== blockId,
      ),
      updatedAt: this.clock(),
    });
    await this.refreshState(["availabilityBlocks"]);
    return this.state;
  }

  async setAvailabilityRule(input: AvailabilityRuleInput): Promise<AvailabilityRule> {
    const saved = await this.performMutation<{ readonly id: string }>(
      "v1/availability-rules",
      {
        driverId: input.driverId ?? null,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        endMinute: input.endMinute,
        id: input.id ?? null,
        kind: input.kind,
        startMinute: input.startMinute,
        weekday: input.weekday,
      },
      ["availabilityRules"],
    );
    const rule = this.state.availabilityRules.find((candidate) => candidate.id === saved.id);
    if (!rule) {
      throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
    }
    return rule;
  }

  async removeAvailabilityRule(ruleId: EntityId): Promise<DemoOperationsState> {
    await this.performMutation<{ readonly id: string }>(
      `v1/availability-rules/${encodeId(ruleId)}/removal`,
      {},
      // Removing a pattern also removes the blocks it expanded into.
      ["availabilityRules", "availabilityBlocks"],
    );
    return this.state;
  }

  async setDriverShift(input: DriverShiftInput): Promise<DriverShift> {
    const saved = await this.performMutation<{ readonly id: string }>(
      "v1/shifts",
      {
        driverId: input.driverId,
        endsAt: input.endsAt,
        id: input.id ?? null,
        note: input.note ?? null,
        startsAt: input.startsAt,
        status: input.status ?? "scheduled",
      },
      ["driverShifts", "scheduleSyncStatuses"],
    );
    return this.requireDriverShift(saved.id);
  }

  async removeDriverShift(shiftId: EntityId): Promise<DemoOperationsState> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(shiftId)}/removal`,
      {},
      ["driverShifts", "shiftCoverageRequests", "scheduleSyncStatuses"],
    );
    return this.state;
  }

  async requestShiftCoverage(input: ShiftCoverageRequestInput): Promise<ShiftCoverageRequest> {
    const created = await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(input.shiftId)}/coverage`,
      { targetDriverId: input.targetDriverId },
      ["shiftCoverageRequests"],
    );
    return this.requireCoverageRequest(created.id);
  }

  async respondToShiftCoverage(
    requestId: EntityId,
    response: "accepted" | "declined",
  ): Promise<ShiftCoverageRequest> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shift-coverage/${encodeId(requestId)}/response`,
      { response },
      ["driverShifts", "shiftCoverageRequests", "scheduleSyncStatuses"],
    );
    return this.requireCoverageRequest(requestId);
  }

  async retryScheduleSync(shiftId: EntityId): Promise<ScheduleSyncStatus> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shifts/${encodeId(shiftId)}/sync-retry`,
      {},
      ["scheduleSyncStatuses"],
    );
    return this.requireScheduleSync(shiftId);
  }

  /**
   * Payout handles never enter `OperationsState`, so these read and write the
   * endpoint directly. The server scopes every one of them to the calling
   * driver; there is no path here that can name another driver's handle.
   */
  async listPayoutMethods(): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>("v1/payout-methods");
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async savePayoutMethod(input: PayoutMethodInput): Promise<PayoutMethod> {
    this.requireIdentity();
    // Validated locally first so an obviously wrong handle never leaves the
    // device, and so the driver gets the same message either repository gives.
    const handle = normalizePayoutHandle(input.rail, input.handle);
    try {
      return await this.apiClient.requestJson<PayoutMethod>("v1/payout-methods", {
        body: { handle, id: input.id ?? null, isDefault: input.isDefault ?? null, label: input.label ?? null, rail: input.rail },
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async removePayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>(
        `v1/payout-methods/${encodeId(methodId)}/removal`,
        { body: {}, idempotencyKey: this.idFactory(), method: "POST" },
      );
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async setDefaultPayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    this.requireIdentity();
    try {
      return await this.apiClient.requestJson<readonly PayoutMethod[]>(
        `v1/payout-methods/${encodeId(methodId)}/default`,
        { body: {}, idempotencyKey: this.idFactory(), method: "POST" },
      );
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  async upsertVehicle(input: VehicleInput): Promise<Vehicle> {
    const saved = await this.performMutation<{ readonly id: string }>("v1/vehicles", {
      assignedDriverId: input.assignedDriverId ?? null,
      id: input.id ?? null,
      make: input.make,
      model: input.model,
      odometerMiles: input.odometerMiles,
      plateNumber: input.plateNumber,
      plateState: input.plateState,
      status: input.status,
      type: input.type,
      unitNumber: input.unitNumber,
      vin: input.vin,
      year: input.year,
    }, ["vehicles"]);
    return this.requireVehicle(saved.id);
  }

  async assignVehicle(vehicleId: EntityId, driverId: EntityId | null): Promise<Vehicle> {
    await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/assignment`,
      { driverId },
      ["vehicles"],
    );
    return this.requireVehicle(vehicleId);
  }

  async transferVehicle(
    vehicleId: EntityId,
    targetDriverId: EntityId,
    note: string,
  ): Promise<Vehicle> {
    await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/transfer`,
      { note: note.trim(), targetDriverId },
      ["vehicles"],
    );
    return this.requireVehicle(vehicleId);
  }

  async updateVehicleThumbnail(
    vehicleId: EntityId,
    source: VehicleThumbnailSource,
  ): Promise<Vehicle> {
    this.requireIdentity();
    const uploadBody = await readUploadBody({ uri: source.uri }, this.fetchImplementation);
    const intent = await this.apiClient.requestJson<VehicleThumbnailUploadIntent>(
      `v1/vehicles/${encodeId(vehicleId)}/thumbnail-upload-intent`,
      {
        body: {
          byteSize: uploadBody.byteSize,
          contentType: source.contentType,
          fileName: source.fileName,
        },
        idempotencyKey: this.idFactory(),
        method: "POST",
      },
    );
    await uploadToSignedUrl(intent.upload, uploadBody, {
      baseUrl: this.uploadBaseUrl,
      fetchImplementation: this.fetchImplementation,
    });
    const saved = await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/thumbnail`,
      { path: intent.path },
      ["vehicles"],
    );
    return this.requireVehicle(saved.id);
  }

  async createMaintenanceOrder(input: MaintenanceOrderInput): Promise<MaintenanceOrder> {
    const created = await this.performMutation<{ readonly id: string }>("v1/maintenance", {
      costCents: input.costCents ?? null,
      description: input.description,
      kind: input.kind,
      odometerMiles: input.odometerMiles ?? null,
      reportedByDriverId: input.reportedByDriverId ?? null,
      scheduledFor: input.scheduledFor ?? null,
      severity: input.severity,
      summary: input.summary,
      vehicleId: input.vehicleId,
      vendorName: input.vendorName ?? null,
      // A critical order grounds the unit, so the fleet changes too.
    }, ["maintenanceOrders", "vehicles"]);
    return this.requireMaintenanceOrder(created.id);
  }

  async updateMaintenanceOrder(
    orderId: EntityId,
    patch: MaintenanceOrderPatch,
  ): Promise<MaintenanceOrder> {
    await this.performMutation<{ readonly id: string }>(
      `v1/maintenance/${encodeId(orderId)}`,
      {
        completedAt: patch.completedAt ?? null,
        costCents: patch.costCents ?? null,
        description: patch.description ?? null,
        scheduledFor: patch.scheduledFor ?? null,
        severity: patch.severity ?? null,
        status: patch.status ?? null,
        vendorName: patch.vendorName ?? null,
      },
      // Closing the last open order returns the unit to service.
      ["maintenanceOrders", "vehicles"],
    );
    return this.requireMaintenanceOrder(orderId);
  }

  async upsertComplianceDocument(input: ComplianceDocumentInput): Promise<ComplianceDocument> {
    const saved = await this.performMutation<{ readonly id: string }>("v1/compliance", {
      expiresOn: input.expiresOn,
      id: input.id ?? null,
      identifier: input.identifier,
      issuedOn: input.issuedOn,
      issuingState: input.issuingState,
      kind: input.kind,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
    }, ["complianceDocuments"]);
    const document = this.state.complianceDocuments.find((candidate) => candidate.id === saved.id);
    if (!document) {
      throw new OperationsDomainError("NOT_FOUND", "That compliance document could not be found.");
    }
    return document;
  }

  async issuePayout(
    driverId: EntityId,
    periodStart: IsoDateTime,
    periodEnd: IsoDateTime,
  ): Promise<Payout> {
    const issued = await this.performMutation<{ readonly id: string }>("v1/payouts", {
      driverId,
      periodEnd,
      periodStart,
    }, ["payouts"]);
    return this.requirePayout(issued.id);
  }

  async markPayoutPaid(payoutId: EntityId, rail: PayoutRail): Promise<Payout> {
    await this.performMutation<{ readonly id: string }>(
      `v1/payouts/${encodeId(payoutId)}/payment`,
      { rail },
      ["payouts"],
    );
    return this.requirePayout(payoutId);
  }

  private requireAvailabilityBlock(blockId: EntityId): AvailabilityBlock {
    const block = this.state.availabilityBlocks.find((candidate) => candidate.id === blockId);
    if (!block) {
      throw new OperationsDomainError("NOT_FOUND", "That availability block could not be found.");
    }
    return block;
  }

  private requireDriverShift(shiftId: EntityId): DriverShift {
    const shift = this.state.driverShifts.find((candidate) => candidate.id === shiftId);
    if (!shift) {
      throw new OperationsDomainError("NOT_FOUND", "That driver shift could not be found.");
    }
    return shift;
  }

  private requireCoverageRequest(requestId: EntityId): ShiftCoverageRequest {
    const request = this.state.shiftCoverageRequests.find((candidate) => candidate.id === requestId);
    if (!request) {
      throw new OperationsDomainError("NOT_FOUND", "That coverage request could not be found.");
    }
    return request;
  }

  private requireScheduleSync(shiftId: EntityId): ScheduleSyncStatus {
    const status = this.state.scheduleSyncStatuses.find((candidate) => candidate.entityId === shiftId);
    if (!status) {
      throw new OperationsDomainError("NOT_FOUND", "That schedule sync status could not be found.");
    }
    return status;
  }

  private requireVehicle(vehicleId: EntityId): Vehicle {
    const vehicle = this.state.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) {
      throw new OperationsDomainError("NOT_FOUND", "The vehicle could not be found.", { vehicleId });
    }
    return vehicle;
  }

  private requireMaintenanceOrder(orderId: EntityId): MaintenanceOrder {
    const order = this.state.maintenanceOrders.find((candidate) => candidate.id === orderId);
    if (!order) {
      throw new OperationsDomainError("NOT_FOUND", "That work order could not be found.");
    }
    return order;
  }

  private requirePayout(payoutId: EntityId): Payout {
    const payout = this.state.payouts.find((candidate) => candidate.id === payoutId);
    if (!payout) {
      throw new OperationsDomainError("NOT_FOUND", "That settlement could not be found.");
    }
    return payout;
  }

  getShipmentEdiTransactions(shipmentId: EntityId): readonly EdiTransaction[] {
    return this.state.ediTransactions.filter((transaction) => transaction.shipmentId === shipmentId);
  }

  async syncOfflineMutations(): Promise<void> {
    const report = await this.offlineQueue.flush(
      (mutation) => this.sendOfflineMutation(mutation),
      this.queueHooks,
    );
    if (report.processed > 0) {
      await this.refreshState();
    }
  }

  private async refreshState(refresh: ExtendedRefresh = "cached"): Promise<void> {
    const identity = this.identity;
    if (identity?.accessState === "pending_customer_approval") {
      await this.refreshPendingCustomerState(identity);
      return;
    }
    try {
      const bootstrap = await this.apiClient.requestJson<MobileBootstrapPayload>("v1/bootstrap");
      const isAdmin = bootstrap.user.role === "admin";
      const isStaff = isAdmin || bootstrap.user.role === "driver";
      const [shipments, requests, exceptions, messages] = await Promise.all([
        this.apiClient.requestJson<readonly MobileShipmentRow[]>("v1/shipments?limit=100"),
        bootstrap.user.role === "driver"
          ? Promise.resolve([])
          : this.apiClient.requestJson<readonly MobileFreightRequestRow[]>("v1/requests?limit=100"),
        this.apiClient.requestJson<readonly MobileExceptionRow[]>("v1/exceptions?limit=100"),
        this.apiClient.requestJson<readonly MobileMessageRow[]>("v1/messages?limit=100"),
      ]);

      /**
       * The fleet, calendar, shop, compliance, and settlement collections.
       *
       * Fetched only for the roles allowed to read them, and each one tolerated
       * individually: a server that has not deployed these endpoints yet, or an
       * endpoint that is briefly failing, leaves its screen empty rather than
       * taking the whole session down with it.
       */
      const extended = await this.loadExtendedCollections(isAdmin, isStaff, refresh);

      const state = buildProductionOperationsState(
        { ...extended, bootstrap, exceptions, messages, requests, shipments },
        this.clock(),
      );
      this.replaceState(requireProductionState(state, this.identity));
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  /**
   * Pending customers are refused by bootstrap/shipments on purpose. Only the
   * freight requests they own are readable until an admin links their account.
   */
  private async refreshPendingCustomerState(identity: AuthIdentity): Promise<void> {
    try {
      const requests = await this.apiClient.requestJson<readonly MobileFreightRequestRow[]>(
        "v1/requests?limit=100",
      );
      this.replaceState(
        requireProductionState(
          buildPendingCustomerOperationsState(identity, requests, this.clock()),
          identity,
        ),
      );
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  /**
   * Fleet, calendar, shop, compliance, and settlement collections.
   *
   * These are refetched only when the caller says a write touched them.
   * `refreshState` runs after every mutation, and re-reading six endpoints each
   * time a driver advances a stop would put five useless round-trips on a
   * connection that is often a phone in a moving truck. Everything not
   * refetched is served from the copy the last read produced.
   */
  private async loadExtendedCollections(
    isAdmin: boolean,
    isStaff: boolean,
    refresh: ExtendedRefresh,
  ): Promise<ExtendedCollections> {
    const wanted = (key: keyof ExtendedCollections): boolean => (
      refresh === "all" || (Array.isArray(refresh) && refresh.includes(key))
    );
    const cached = this.extendedCollections;

    const [
      availabilityBlocks,
      availabilityRules,
      driverShifts,
      shiftCoverageRequests,
      scheduleSyncStatuses,
      vehicles,
      maintenanceOrders,
      complianceDocuments,
      payouts,
    ] = await Promise.all([
      isStaff && wanted("availabilityBlocks")
        ? this.optionalCollection<AvailabilityBlock>("v1/availability?limit=200")
        : cached.availabilityBlocks,
      isStaff && wanted("availabilityRules")
        ? this.optionalCollection<AvailabilityRule>("v1/availability-rules?limit=200")
        : cached.availabilityRules,
      isStaff && wanted("driverShifts")
        ? this.optionalCollection<DriverShift>("v1/shifts?limit=500")
        : cached.driverShifts,
      isStaff && wanted("shiftCoverageRequests")
        ? this.optionalCollection<ShiftCoverageRequest>("v1/shift-coverage?limit=200")
        : cached.shiftCoverageRequests,
      isStaff && wanted("scheduleSyncStatuses")
        ? this.optionalCollection<ScheduleSyncStatus>("v1/schedule-sync?limit=500")
        : cached.scheduleSyncStatuses,
      isAdmin && wanted("vehicles")
        ? this.optionalCollection<Vehicle>("v1/vehicles?limit=100")
        : cached.vehicles,
      isAdmin && wanted("maintenanceOrders")
        ? this.optionalCollection<MaintenanceOrder>("v1/maintenance?limit=100")
        : cached.maintenanceOrders,
      isAdmin && wanted("complianceDocuments")
        ? this.optionalCollection<ComplianceDocument>("v1/compliance?limit=200")
        : cached.complianceDocuments,
      isStaff && wanted("payouts")
        ? this.optionalCollection<Payout>("v1/payouts?limit=100")
        : cached.payouts,
    ]);

    this.extendedCollections = {
      availabilityBlocks,
      availabilityRules,
      driverShifts,
      shiftCoverageRequests,
      scheduleSyncStatuses,
      complianceDocuments,
      maintenanceOrders,
      payouts,
      vehicles,
    };
    return this.extendedCollections;
  }

  /**
   * A collection whose absence is survivable. Returns an empty list rather than
   * throwing, so one unavailable endpoint cannot block sign-in.
   *
   * The shape is checked as well as the call: an endpoint that answers with
   * something other than a list would otherwise put a non-array straight into
   * state, where it fails validation and takes the whole session down — the
   * exact outcome this is meant to avoid.
   */
  private async optionalCollection<Row>(path: string): Promise<readonly Row[]> {
    try {
      const rows = await this.apiClient.requestJson<readonly Row[]>(path);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  /** Online writes return only their own result; state is re-read afterwards. */
  private async performMutation<Result>(
    path: string,
    body: unknown,
    refresh: ExtendedRefresh = "cached",
  ): Promise<Result> {
    this.requireIdentity();
    let result: Result;
    try {
      result = await this.apiClient.requestJson<Result>(path, {
        body,
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
    await this.refreshState(refresh);
    return result;
  }

  private async enqueueAndSync(draft: OfflineMutationDraft): Promise<OfflineMutation> {
    const mutation = await this.offlineQueue.enqueue(draft);
    await this.syncOfflineMutations();
    return mutation;
  }

  private async sendOfflineMutation(mutation: OfflineMutation): Promise<void> {
    const documentId = await this.uploadPendingDocument(mutation);
    const operation = toMutationOperation(mutation, documentId);
    if (!operation) {
      return;
    }
    await this.apiClient.requestJson<unknown>("v1/mutations", {
      body: { mutations: [operation] },
      idempotencyKey: mutation.idempotencyKey,
      method: "POST",
    });
  }

  /** Uploads retained photo/signature bytes, returning the linked document id. */
  private async uploadPendingDocument(mutation: OfflineMutation): Promise<string | undefined> {
    if (mutation.kind === "photo") {
      const payload = mutation.payload as {
        readonly fileName: string;
        readonly fileUri: string;
        readonly mimeType: string;
      };
      return this.uploadDocument(mutation, {
        contentType: uploadContentType(payload.mimeType, "image/jpeg"),
        fileName: payload.fileName,
        kind: "photo",
        source: { uri: payload.fileUri },
      });
    }
    if (mutation.kind === "signature") {
      const payload = mutation.payload as { readonly signatureData: string };
      if (payload.signatureData.startsWith("file://")) {
        return this.uploadDocument(mutation, {
          contentType: uploadContentType(mimeTypeFromUri(payload.signatureData), "image/png"),
          fileName: fileNameFromUri(payload.signatureData),
          kind: "signature",
          source: { uri: payload.signatureData },
        });
      }
      return this.uploadDocument(mutation, {
        contentType: "image/png",
        fileName: "signature.png",
        kind: "signature",
        source: { base64: payload.signatureData },
      });
    }
    return undefined;
  }

  private async uploadDocument(
    mutation: OfflineMutation,
    input: {
      readonly contentType: string;
      readonly fileName: string;
      readonly kind: "photo" | "signature";
      readonly source: UploadSource;
    },
  ): Promise<string> {
    const body = await readUploadBody(input.source, this.fetchImplementation);
    const intent = await this.apiClient.requestJson<UploadIntentResponse>(
      "v1/documents/upload-intent",
      {
        body: {
          byteSize: body.byteSize,
          contentType: input.contentType,
          fileName: input.fileName,
          kind: input.kind,
          shipmentId: mutation.shipmentId,
        },
        idempotencyKey: `${mutation.idempotencyKey}-upload-${mutation.attempts}`,
        method: "POST",
      },
    );
    await uploadToSignedUrl(intent.upload, body, {
      baseUrl: this.uploadBaseUrl,
      fetchImplementation: this.fetchImplementation,
    });
    return intent.documentId;
  }

  private async enqueueAttachmentMutations(
    identity: AuthIdentity,
    shipment: Shipment,
    uris: readonly string[],
  ): Promise<void> {
    for (const uri of uris) {
      await this.offlineQueue.enqueue({
        entityId: shipment.id,
        entityVersion: shipmentVersion(shipment),
        kind: "photo",
        ownerUserId: identity.userId,
        payload: { fileName: fileNameFromUri(uri), fileUri: uri, mimeType: mimeTypeFromUri(uri) },
        pendingFileUris: [uri],
        shipmentId: shipment.id,
      });
    }
  }

  private async enqueueSignatureMutation(
    identity: AuthIdentity,
    shipment: Shipment,
    signatureData: string,
  ): Promise<void> {
    await this.offlineQueue.enqueue({
      entityId: shipment.id,
      entityVersion: shipmentVersion(shipment),
      kind: "signature",
      ownerUserId: identity.userId,
      payload: { signatureData },
      pendingFileUris: signatureData.startsWith("file://") ? [signatureData] : [],
      shipmentId: shipment.id,
    });
  }

  private requireIdentity(): AuthIdentity {
    if (!this.identity) {
      throw new OperationsDomainError("UNAUTHORIZED", "Sign in to use freight operations.");
    }
    return this.identity;
  }

  private requireShipment(shipmentId: string): Shipment {
    const shipment = this.state.shipments.find((candidate) => candidate.id === shipmentId);
    if (!shipment) {
      throw new OperationsDomainError("NOT_FOUND", "The shipment could not be found.");
    }
    return shipment;
  }

  private requireException(exceptionId: string): ExceptionReport {
    const report = this.state.exceptions.find((candidate) => candidate.id === exceptionId);
    if (!report) {
      throw new OperationsDomainError("NOT_FOUND", "The exception report could not be found.");
    }
    return report;
  }

  private requireRequest(requestId: string): CustomerRequest {
    const request = this.state.requests.find((candidate) => candidate.id === requestId);
    if (!request) {
      throw new OperationsDomainError("NOT_FOUND", "The freight request could not be found.");
    }
    return request;
  }

  private requireMessage(messageId: string): OperationsMessage {
    const message = this.state.messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      throw new OperationsDomainError("NOT_FOUND", "The message could not be found.");
    }
    return message;
  }

  private findActiveShipment(): Shipment | null {
    return this.state.shipments.find((shipment) => (
      shipment.status !== "delivered" && shipment.status !== "cancelled" && shipment.status !== "declined"
    )) ?? null;
  }

  private requireCurrentDriverId(): string {
    const account = this.state.accounts.find((candidate) => candidate.id === this.state.session.accountId);
    if (!account?.driverId) {
      throw new OperationsDomainError("UNAUTHORIZED", "A driver account is required.");
    }
    return account.driverId;
  }

  private replaceState(state: DemoOperationsState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}

function requireProductionState(
  state: DemoOperationsState,
  identity: AuthIdentity | null,
): DemoOperationsState {
  if (!isDemoOperationsState(state) || state.accounts.some((account) => account.demoPin !== undefined)) {
    throw new OperationsDomainError("VALIDATION_FAILED", "The operations service returned invalid data.");
  }
  const account = state.accounts.find(({ id }) => id === state.session.accountId);
  if (!identity || account?.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) {
    throw new OperationsDomainError("UNAUTHORIZED", "The operations membership does not match this session.");
  }
  return state;
}

function createEmptyOperationsState(updatedAt: string): DemoOperationsState {
  return {
    accounts: [],
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
    requests: [],
    session: { accountId: null, effectiveRole: null },
    shipments: [],
    updatedAt,
    vehicles: [],
    version: DEMO_STATE_VERSION,
  };
}

function updateDutyStatus(
  state: DemoOperationsState,
  driverId: string,
  status: HosDutyStatus,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    hosClocks: state.hosClocks.map((clock) => clock.driverId === driverId
      ? { ...clock, status, statusStartedAt: occurredAt }
      : clock),
    updatedAt: occurredAt,
  };
}

function updateDriverLocation(
  state: DemoOperationsState,
  driverId: string,
  coordinates: GeoPoint,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    drivers: state.drivers.map((driver) => driver.id === driverId
      ? { ...driver, currentLocation: coordinates, locationUpdatedAt: occurredAt }
      : driver),
    updatedAt: occurredAt,
  };
}

function createOptimisticException(
  mutation: OfflineMutation,
  userId: string,
  input: ExceptionReportInput,
): ExceptionReport {
  return {
    attachmentUris: input.attachmentUris ?? [],
    category: input.category,
    description: input.description,
    id: mutation.idempotencyKey,
    reportedAt: mutation.deviceCreatedAt,
    reportedByAccountId: userId,
    severity: input.severity,
    shipmentId: mutation.shipmentId,
    status: "open",
    stopId: input.stopId,
  };
}

function createOptimisticProof(
  mutation: OfflineMutation,
  userId: string,
  shipmentId: string,
  input: ProofOfDeliveryInput,
): ProofOfDelivery {
  return {
    attachments: (input.attachments ?? []).map((attachment, index) => ({
      ...attachment,
      id: `${mutation.idempotencyKey}-attachment-${index}`,
    })),
    id: mutation.idempotencyKey,
    notes: input.notes ?? "",
    recipientName: input.recipientName,
    shipmentId,
    signatureData: input.signatureData,
    status: "submitted",
    stopId: input.stopId,
    submittedAt: mutation.deviceCreatedAt,
    submittedByAccountId: userId,
  };
}

function toFreightLocation(location: FreightRequestLocationInput) {
  return {
    addressLine1: location.addressLine1,
    city: location.city,
    countryCode: "US",
    postalCode: location.postalCode,
    state: location.state,
    ...(location.name ? { name: location.name } : {}),
  };
}

/** The server only resumes an exception into a status it can transition to. */
function resumableStatus(status: ShipmentStatus): "dispatched" | "in_transit" | "at_delivery" {
  if (status === "in_transit" || status === "loaded") return "in_transit";
  if (status === "at_delivery") return "at_delivery";
  return "dispatched";
}

function shipmentVersion(shipment: Shipment | null): number {
  return shipment?.entityVersion ?? shipment?.events.length ?? 0;
}

function fileNameFromUri(uri: string): string {
  const fileName = uri.split("/").at(-1)?.split("?")[0];
  return fileName?.trim() || "freight-attachment";
}

function mimeTypeFromUri(uri: string): string {
  const extension = fileNameFromUri(uri).split(".").at(-1)?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "heic") return "image/heic";
  if (extension === "pdf") return "application/pdf";
  return "application/octet-stream";
}

/** Upload intents only accept the document content types the backend signs. */
function uploadContentType(mimeType: string, fallback: "image/jpeg" | "image/png"): string {
  const allowed = new Set([
    "application/pdf",
    "image/heic",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  return allowed.has(mimeType) ? mimeType : fallback;
}

function encodeId(value: string): string {
  return encodeURIComponent(value);
}

function productionOnlyError(message: string): OperationsDomainError {
  return new OperationsDomainError("UNAUTHORIZED", message);
}

function toDomainNetworkError(error: unknown): OperationsDomainError {
  if (error instanceof OperationsDomainError) {
    return error;
  }
  if (error instanceof NetworkRequestError && error.failure.status === 409) {
    return new OperationsDomainError("CONFLICT", error.failure.message);
  }
  if (error instanceof NetworkRequestError) {
    return new OperationsDomainError("NETWORK_FAILED", error.failure.message, {
      requestId: error.failure.requestId,
      status: error.failure.status,
    });
  }
  return new OperationsDomainError("NETWORK_FAILED", "Freight operations could not be reached.");
}
