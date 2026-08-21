import { randomUUID } from "expo-crypto";

import { OperationsDomainError } from "../domain/errors";
import type {
  HydrationResult,
  OperationsRepository,
  OperationsStateListener,
} from "../domain/repository";
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
} from "../domain/types";
import { DEMO_STATE_VERSION } from "../domain/types";
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
  buildProductionOperationsState,
  type MobileBootstrapPayload,
  type MobileFreightRequestRow,
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

interface ProductionMutationResponse<Result> {
  readonly result: Result;
  readonly state: DemoOperationsState;
}

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
    await this.refreshState();
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
    return this.performMutation(`/v1/shipments/${encodeId(shipmentId)}/tender-response`, { response });
  }

  async assignShipment(
    shipmentId: EntityId,
    driverId: EntityId,
    tractorId?: EntityId,
    trailerId?: EntityId,
  ): Promise<Shipment> {
    return this.performMutation(`/v1/shipments/${encodeId(shipmentId)}/assignment`, {
      driverId,
      tractorId,
      trailerId,
    });
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

  async advanceIntermediateStop(shipmentId: EntityId, stopId: EntityId): Promise<Shipment> {
    return this.performMutation(
      `/v1/shipments/${encodeId(shipmentId)}/stops/${encodeId(stopId)}/advance`,
      {},
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
    return this.performMutation(`/v1/exceptions/${encodeId(exceptionId)}/resolution`, {
      resolutionNote,
      resumeStatus,
    });
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
    return this.performMutation("/v1/messages", input);
  }

  async createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest> {
    return this.performMutation("/v1/customer-requests", input);
  }

  async markMessageRead(messageId: EntityId): Promise<OperationsMessage> {
    return this.performMutation(`/v1/messages/${encodeId(messageId)}/read`, {});
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

  private async refreshState(): Promise<void> {
    try {
      const bootstrap = await this.apiClient.requestJson<MobileBootstrapPayload>("v1/bootstrap");
      const [shipments, requests] = await Promise.all([
        this.apiClient.requestJson<readonly MobileShipmentRow[]>("v1/shipments?limit=100"),
        bootstrap.user.role === "driver"
          ? Promise.resolve([])
          : this.apiClient.requestJson<readonly MobileFreightRequestRow[]>("v1/requests?limit=100"),
      ]);
      const state = buildProductionOperationsState(
        bootstrap,
        shipments,
        requests,
        this.clock(),
      );
      this.replaceState(requireProductionState(state, this.identity));
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
  }

  private async performMutation<Result>(path: string, body: unknown): Promise<Result> {
    this.requireIdentity();
    try {
      const response = await this.apiClient.requestJson<ProductionMutationResponse<Result>>(path, {
        body,
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
      this.replaceState(requireProductionState(response.state, this.identity));
      return response.result;
    } catch (error: unknown) {
      throw toDomainNetworkError(error);
    }
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
    requests: [],
    session: { accountId: null, effectiveRole: null },
    shipments: [],
    updatedAt,
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
