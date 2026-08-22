import {
  OperationsDomainError,
  toOperationsFailure,
} from "../domain/errors";
import {
  anchorDemoStateTo,
  createDemoOperationsState,
  reanchorDemoState,
} from "../domain/fixtures";
import type {
  HydrationResult,
  OperationsRepository,
  OperationsStateListener,
} from "../domain/repository";
import {
  transitionHosStatus,
  transitionShipmentStatus,
} from "../domain/transitions";
import { buildPayoutLineItems, summarizePayout } from "../domain/payouts";
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
  Driver,
  EdiTransaction,
  EdiTransactionType,
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
  OperationsAccount,
  Payout,
  PayoutMethod,
  PayoutMethodInput,
  PayoutRail,
  ProofOfDelivery,
  ProofOfDeliveryInput,
  SendMessageInput,
  Shipment,
  ShipmentEvent,
  ShipmentEventSource,
  ShipmentStatus,
  Vehicle,
  VehicleInput,
} from "../domain/types";
import { PayoutMethodStore } from "./payoutMethodStore";
import { AsyncStoragePersistenceAdapter, type PersistenceAdapter } from "./persistence";
import {
  deserializeDemoOperationsState,
  serializeDemoOperationsState,
} from "./stateSchema";

export interface DemoOperationsRepositoryOptions {
  readonly persistence?: PersistenceAdapter;
  readonly clock?: () => string;
  /** Injected in tests so payout handles never reach a real keychain. */
  readonly payoutMethods?: PayoutMethodStore;
}

interface StateUpdate<Result> {
  readonly state: DemoOperationsState;
  readonly result: Result;
}

interface SessionContext {
  readonly account: OperationsAccount;
  readonly effectiveRole: AppRole;
  readonly customerId?: EntityId;
  readonly driverId?: EntityId;
}

const ACTIVE_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  "dispatched",
  "at_pickup",
  "loaded",
  "in_transit",
  "at_delivery",
]);

const RESERVED_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  "accepted",
  ...ACTIVE_SHIPMENT_STATUSES,
]);

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
    this.state = this.freshState();
  }

  /**
   * The fixture timeline is anchored onto the current day so a long-lived demo
   * never drifts entirely into the past. Anchoring reads the injected clock, so
   * a test pinning the clock to the fixture anchor sees the canonical data.
   */
  private freshState(): DemoOperationsState {
    return anchorDemoStateTo(createDemoOperationsState(), new Date(this.clock()));
  }

  hydrate(): Promise<HydrationResult> {
    return this.enqueue(async () => {
      try {
        const serialized = await this.persistence.read();
        if (serialized === null) {
          await this.persistence.write(serializeDemoOperationsState(this.state));
          return { state: this.state, recoveryFailure: null };
        }

        // Restored state carries whatever day it was last anchored to, so it
        // is moved onto today before anyone reads it.
        this.state = reanchorDemoState(
          deserializeDemoOperationsState(serialized),
          new Date(this.clock()),
        );
        this.notify();
        return { state: this.state, recoveryFailure: null };
      } catch (error: unknown) {
        const failure = toOperationsFailure(error);
        const fallbackState = this.freshState();

        if (
          !(error instanceof OperationsDomainError) ||
          error.code !== "CORRUPT_PERSISTED_STATE"
        ) {
          this.state = fallbackState;
          this.notify();
          return { state: this.state, recoveryFailure: failure };
        }

        try {
          await this.persistence.write(serializeDemoOperationsState(fallbackState));
        } catch (persistenceError: unknown) {
          this.state = fallbackState;
          this.notify();
          return {
            state: this.state,
            recoveryFailure: toOperationsFailure(persistenceError),
          };
        }

        this.state = fallbackState;
        this.notify();
        return { state: this.state, recoveryFailure: failure };
      }
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
    return this.commit((state, occurredAt) => {
      const normalizedEmail = email.trim().toLowerCase();
      const account = state.accounts.find(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.demoPin === pin,
      );

      if (!account) {
        throw new OperationsDomainError(
          "AUTHENTICATION_FAILED",
          "The demo email or PIN is incorrect.",
        );
      }

      const nextState: DemoOperationsState = {
        ...state,
        session: { accountId: account.id, effectiveRole: account.role },
        updatedAt: occurredAt,
      };
      return { state: nextState, result: nextState };
    });
  }

  signOut(): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      const nextState: DemoOperationsState = {
        ...state,
        session: { accountId: null, effectiveRole: null },
        updatedAt: occurredAt,
      };
      return { state: nextState, result: nextState };
    });
  }

  switchDemoRole(role: AppRole): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      if (context.account.role !== "admin") {
        throw new OperationsDomainError(
          "UNAUTHORIZED",
          "Only the admin demo account can switch roles.",
        );
      }

      const nextState: DemoOperationsState = {
        ...state,
        session: { accountId: context.account.id, effectiveRole: role },
        updatedAt: occurredAt,
      };
      return { state: nextState, result: nextState };
    });
  }

  resetDemo(): Promise<DemoOperationsState> {
    return this.enqueue(async () => {
      const resetState = this.freshState();
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
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireRole(context, "admin", "Only an admin can respond to a load tender.");
      const shipment = findShipment(state, shipmentId);
      const transitioned = transitionShipmentStatus(shipment, response, {
        eventId: this.nextId("event", occurredAt),
        occurredAt,
        source: "admin",
      });
      let nextState = replaceShipment(state, transitioned, occurredAt);
      nextState = appendEdiTransaction(
        nextState,
        createEdiTransaction(
          this.nextId("edi", occurredAt),
          transitioned,
          "990",
          response === "accepted" ? "Load tender acceptance" : "Load tender decline",
          occurredAt,
        ),
        occurredAt,
      );
      return { state: nextState, result: transitioned };
    });
  }

  assignShipment(shipmentId: EntityId, driverId: EntityId): Promise<Shipment> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireRole(context, "admin", "Only an admin can assign a shipment.");
      const shipment = findShipment(state, shipmentId);
      if (shipment.status !== "accepted" && shipment.status !== "dispatched") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "A shipment must be accepted before a driver can be assigned.",
        );
      }
      assertDriverAssignable(state, shipment, driverId);

      const assignedShipment: Shipment = {
        ...shipment,
        assignedDriverId: driverId,
        updatedAt: occurredAt,
      };
      const nextState: DemoOperationsState = replaceShipment(state, assignedShipment, occurredAt);
      return { state: nextState, result: assignedShipment };
    });
  }

  transitionShipment(
    shipmentId: EntityId,
    nextStatus: ShipmentStatus,
    stopId?: EntityId,
  ): Promise<Shipment> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const shipment = findShipment(state, shipmentId);
      assertCanOperateShipment(context, shipment);

      if (nextStatus === "accepted" || nextStatus === "declined") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Use the tender response action to accept or decline a load.",
        );
      }
      if (nextStatus === "delivered") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Proof of delivery is required before a load can be delivered.",
        );
      }
      if (nextStatus === "exception") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Use the exception report action to place a load in exception status.",
        );
      }
      if ((nextStatus === "dispatched" || nextStatus === "cancelled") && context.effectiveRole !== "admin") {
        throw new OperationsDomainError(
          "UNAUTHORIZED",
          "Only an admin can dispatch or cancel a load.",
        );
      }
      if (nextStatus === "dispatched" && !shipment.assignedDriverId) {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Assign a driver before dispatching this load.",
        );
      }

      const transitioned = transitionShipmentStatus(shipment, nextStatus, {
        eventId: this.nextId("event", occurredAt),
        occurredAt,
        source: eventSourceForRole(context.effectiveRole),
        stopId,
        coordinates: currentCoordinates(state, context),
      });
      let nextState = replaceShipment(state, transitioned, occurredAt);

      if (isOperationalStatus(nextStatus)) {
        nextState = appendEdiTransaction(
          nextState,
          createEdiTransaction(
            this.nextId("edi", occurredAt),
            transitioned,
            "214",
            `Shipment status: ${nextStatus.replaceAll("_", " ")}`,
            occurredAt,
          ),
          occurredAt,
        );
      }
      return { state: nextState, result: transitioned };
    });
  }

  advanceIntermediateStop(shipmentId: EntityId, stopId: EntityId): Promise<Shipment> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const shipment = findShipment(state, shipmentId);
      assertCanOperateShipment(context, shipment);

      if (shipment.status !== "in_transit") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Intermediate stops can only be updated while a shipment is in transit.",
        );
      }

      const stop = shipment.stops.find((candidate) => candidate.id === stopId);
      if (!stop || stop.type !== "intermediate") {
        throw new OperationsDomainError("NOT_FOUND", "The intermediate stop could not be found.");
      }

      const nextRequiredStop = shipment.stops.find(
        (candidate) => candidate.type === "intermediate" && candidate.status !== "completed" && candidate.status !== "skipped",
      );
      if (nextRequiredStop?.id !== stop.id) {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Route stops must be completed in order.",
          { requiredStopId: nextRequiredStop?.id ?? null },
        );
      }
      if (stop.status !== "pending" && stop.status !== "arrived") {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "This route stop has already been completed.",
          { stopId },
        );
      }

      const arriving = stop.status === "pending";
      const updatedStop = arriving
        ? { ...stop, status: "arrived" as const, arrivedAt: occurredAt }
        : { ...stop, status: "completed" as const, completedAt: occurredAt };
      const event: ShipmentEvent = {
        id: this.nextId("event", occurredAt),
        shipmentId,
        type: arriving ? "arrived_at_stop" : "departed_stop",
        eventCode: arriving ? "X6" : "X8",
        source: eventSourceForRole(context.effectiveRole),
        occurredAt,
        description: arriving
          ? `Arrived at ${stop.facilityName}`
          : `Completed ${stop.facilityName}`,
        stopId,
        coordinates: stop.coordinates,
        isSimulated: true,
      };
      const updatedShipment: Shipment = {
        ...shipment,
        stops: shipment.stops.map((candidate) => candidate.id === stopId ? updatedStop : candidate),
        events: [...shipment.events, event],
        updatedAt: occurredAt,
      };
      let nextState = replaceShipment(state, updatedShipment, occurredAt);
      nextState = appendEdiTransaction(
        nextState,
        createEdiTransaction(
          this.nextId("edi", occurredAt),
          updatedShipment,
          "214",
          event.description,
          occurredAt,
        ),
        occurredAt,
      );
      return { state: nextState, result: updatedShipment };
    });
  }

  transitionDutyStatus(nextStatus: HosDutyStatus): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireRole(context, "driver", "A Driver role is required to update HOS status.");
      const driverId = requireDriverId(context);
      const clock = state.hosClocks.find((candidate) => candidate.driverId === driverId);
      if (!clock) {
        throw new OperationsDomainError("NOT_FOUND", "The driver's HOS clock could not be found.");
      }

      const activeShipment = state.shipments.find(
        (shipment) => shipment.assignedDriverId === driverId && ACTIVE_SHIPMENT_STATUSES.has(shipment.status),
      );
      const transitioned = transitionHosStatus(clock, nextStatus, {
        entryId: this.nextId("hos", occurredAt),
        occurredAt,
        locationDescription: activeShipment
          ? activeShipment.stops.find((stop) => stop.status !== "completed")?.facilityName ?? "Current route"
          : "Current recorded location",
        hasActiveShipment: Boolean(activeShipment),
      });
      const nextState: DemoOperationsState = {
        ...state,
        hosClocks: state.hosClocks.map((candidate) => candidate.driverId === driverId ? transitioned : candidate),
        updatedAt: occurredAt,
      };
      return { state: nextState, result: nextState };
    });
  }

  recordDriverLocation(coordinates: GeoPoint): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      validateCoordinates(coordinates);
      const context = getSessionContext(state);
      requireRole(context, "driver", "A Driver role is required to record GPS movement.");
      const driverId = requireDriverId(context);
      const driver = state.drivers.find((candidate) => candidate.id === driverId);
      if (!driver) {
        throw new OperationsDomainError("NOT_FOUND", "The driver could not be found.");
      }

      const activeShipment = state.shipments.find(
        (shipment) => shipment.assignedDriverId === driverId && ACTIVE_SHIPMENT_STATUSES.has(shipment.status),
      );
      const updatedShipment = activeShipment
        ? {
            ...activeShipment,
            events: [
              ...activeShipment.events,
              {
                id: this.nextId("event", occurredAt),
                shipmentId: activeShipment.id,
                type: "location_update" as const,
                eventCode: "LX",
                source: "driver" as const,
                occurredAt,
                description: "Simulated driver location updated",
                coordinates,
                isSimulated: true as const,
              },
            ],
            updatedAt: occurredAt,
          }
        : null;
      const nextState: DemoOperationsState = {
        ...state,
        drivers: state.drivers.map((candidate) => candidate.id === driverId
          ? { ...candidate, currentLocation: coordinates, locationUpdatedAt: occurredAt }
          : candidate),
        shipments: updatedShipment
          ? state.shipments.map((shipment) => shipment.id === updatedShipment.id ? updatedShipment : shipment)
          : state.shipments,
        updatedAt: occurredAt,
      };
      return { state: nextState, result: nextState };
    });
  }

  reportException(
    shipmentId: EntityId,
    input: ExceptionReportInput,
  ): Promise<ExceptionReport> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const shipment = findShipment(state, shipmentId);
      assertCanOperateShipment(context, shipment);
      requireTrimmedText(input.description, "Exception description", 10, 1_000);
      if (input.stopId && !shipment.stops.some((stop) => stop.id === input.stopId)) {
        throw new OperationsDomainError(
          "NOT_FOUND",
          "The selected shipment stop could not be found.",
          { stopId: input.stopId },
        );
      }

      const report: ExceptionReport = {
        id: this.nextId("exception", occurredAt),
        shipmentId,
        stopId: input.stopId,
        category: input.category,
        severity: input.severity,
        status: "open",
        description: input.description.trim(),
        reportedByAccountId: context.account.id,
        reportedAt: occurredAt,
        attachmentUris: (input.attachmentUris ?? []).filter((uri) => uri.trim().length > 0),
      };
      const transitioned = shipment.status === "exception"
        ? shipment
        : transitionShipmentStatus(shipment, "exception", {
            eventId: this.nextId("event", occurredAt),
            occurredAt,
            source: eventSourceForRole(context.effectiveRole),
            description: report.description,
            stopId: input.stopId,
            coordinates: currentCoordinates(state, context),
          });
      let nextState: DemoOperationsState = {
        ...replaceShipment(state, transitioned, occurredAt),
        exceptions: [...state.exceptions, report],
        updatedAt: occurredAt,
      };
      nextState = appendEdiTransaction(
        nextState,
        createEdiTransaction(
          this.nextId("edi", occurredAt),
          transitioned,
          "214",
          `Exception: ${report.category.replaceAll("_", " ")}`,
          occurredAt,
        ),
        occurredAt,
      );
      return { state: nextState, result: report };
    });
  }

  resolveException(
    exceptionId: EntityId,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<ExceptionReport> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireRole(context, "admin", "Only an admin can resolve shipment exceptions.");
      requireTrimmedText(resolutionNote, "Resolution note", 5, 1_000);
      const report = state.exceptions.find((candidate) => candidate.id === exceptionId);
      if (!report) {
        throw new OperationsDomainError("NOT_FOUND", "The exception report could not be found.");
      }
      if (report.status === "resolved") {
        throw new OperationsDomainError("INVALID_TRANSITION", "This exception is already resolved.");
      }

      const shipment = findShipment(state, report.shipmentId);
      const transitioned = transitionShipmentStatus(shipment, resumeStatus, {
        eventId: this.nextId("event", occurredAt),
        occurredAt,
        source: "admin",
        description: resolutionNote.trim(),
        stopId: report.stopId,
      });
      const lastEvent = transitioned.events.at(-1);
      const resolvedShipment: Shipment = lastEvent
        ? {
            ...transitioned,
            events: [
              ...transitioned.events.slice(0, -1),
              {
                ...lastEvent,
                type: "exception_resolved",
                eventCode: "P1",
                description: resolutionNote.trim(),
              },
            ],
          }
        : transitioned;
      const resolvedReport: ExceptionReport = {
        ...report,
        status: "resolved",
        resolutionNote: resolutionNote.trim(),
        resolvedAt: occurredAt,
      };
      const nextState: DemoOperationsState = {
        ...replaceShipment(state, resolvedShipment, occurredAt),
        exceptions: state.exceptions.map((candidate) => candidate.id === exceptionId ? resolvedReport : candidate),
        updatedAt: occurredAt,
      };
      return { state: nextState, result: resolvedReport };
    });
  }

  submitProofOfDelivery(
    shipmentId: EntityId,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const shipment = findShipment(state, shipmentId);
      assertCanOperateShipment(context, shipment);
      requireTrimmedText(input.recipientName, "Recipient name", 2, 120);
      requireTrimmedText(input.signatureData, "Signature", 3, 100_000);
      (input.attachments ?? []).forEach((attachment) => {
        requireTrimmedText(attachment.uri, "Attachment URI", 3, 10_000);
        requireTrimmedText(attachment.name, "Attachment name", 1, 240);
      });

      if (state.proofsOfDelivery.some((proof) => proof.shipmentId === shipmentId)) {
        throw new OperationsDomainError(
          "INVALID_TRANSITION",
          "Proof of delivery has already been submitted for this shipment.",
        );
      }

      const transitioned = transitionShipmentStatus(shipment, "delivered", {
        eventId: this.nextId("event", occurredAt),
        occurredAt,
        source: eventSourceForRole(context.effectiveRole),
        description: `Shipment delivered to ${input.recipientName.trim()}`,
        stopId: input.stopId,
        coordinates: currentCoordinates(state, context),
      });
      const proof: ProofOfDelivery = {
        id: this.nextId("pod", occurredAt),
        shipmentId,
        stopId: input.stopId,
        status: "submitted",
        recipientName: input.recipientName.trim(),
        signatureData: input.signatureData,
        notes: input.notes?.trim() ?? "",
        attachments: (input.attachments ?? []).map((attachment) => ({
          ...attachment,
          id: this.nextId("attachment", occurredAt),
        })),
        submittedByAccountId: context.account.id,
        submittedAt: occurredAt,
      };
      let nextState: DemoOperationsState = {
        ...replaceShipment(state, transitioned, occurredAt),
        proofsOfDelivery: [...state.proofsOfDelivery, proof],
        updatedAt: occurredAt,
      };
      nextState = appendEdiTransaction(
        nextState,
        createEdiTransaction(
          this.nextId("edi", occurredAt),
          transitioned,
          "214",
          "Shipment delivered with proof of delivery",
          occurredAt,
        ),
        occurredAt,
      );
      return { state: nextState, result: proof };
    });
  }

  sendMessage(input: SendMessageInput): Promise<OperationsMessage> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireTrimmedText(input.body, "Message", 1, 2_000);
      if (input.recipientAccountIds.length === 0) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "Select at least one message recipient.",
        );
      }
      const knownAccountIds = new Set(state.accounts.map((account) => account.id));
      if (input.recipientAccountIds.some((accountId) => !knownAccountIds.has(accountId))) {
        throw new OperationsDomainError("NOT_FOUND", "A message recipient could not be found.");
      }
      if (input.shipmentId) {
        findShipment(state, input.shipmentId);
      }

      const message: OperationsMessage = {
        id: this.nextId("message", occurredAt),
        threadId: input.threadId,
        threadKind: input.threadKind,
        shipmentId: input.shipmentId,
        senderAccountId: context.account.id,
        recipientAccountIds: [...new Set(input.recipientAccountIds)],
        body: input.body.trim(),
        sentAt: occurredAt,
        readByAccountIds: [context.account.id],
      };
      const nextState: DemoOperationsState = {
        ...state,
        messages: [...state.messages, message],
        updatedAt: occurredAt,
      };
      return { state: nextState, result: message };
    });
  }

  createCustomerRequest(input: CreateCustomerRequestInput): Promise<CustomerRequest> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      requireRole(context, "customer", "A Customer role is required to submit a request.");
      requireTrimmedText(input.subject, "Request subject", 3, 160);
      requireTrimmedText(input.details, "Request details", 10, 2_000);
      if (input.shipmentId) {
        const shipment = findShipment(state, input.shipmentId);
        const customerId = requireCustomerId(context);
        if (shipment.customerId !== customerId) {
          throw new OperationsDomainError(
            "UNAUTHORIZED",
            "The selected shipment does not belong to this customer.",
          );
        }
      }

      const customerId = requireCustomerId(context);
      const request: CustomerRequest = {
        id: this.nextId("request", occurredAt),
        customerId,
        shipmentId: input.shipmentId,
        type: input.type,
        status: "submitted",
        subject: input.subject.trim(),
        details: input.details.trim(),
        requestedAt: occurredAt,
        updatedAt: occurredAt,
      };
      const nextState: DemoOperationsState = {
        ...state,
        requests: [...state.requests, request],
        updatedAt: occurredAt,
      };
      return { state: nextState, result: request };
    });
  }

  markMessageRead(messageId: EntityId): Promise<OperationsMessage> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const message = state.messages.find((candidate) => candidate.id === messageId);
      if (!message) {
        throw new OperationsDomainError("NOT_FOUND", "The message could not be found.");
      }
      const canRead = context.effectiveRole === "admin" ||
        message.senderAccountId === context.account.id ||
        message.recipientAccountIds.includes(context.account.id);
      if (!canRead) {
        throw new OperationsDomainError(
          "UNAUTHORIZED",
          "This demo account cannot read the selected message.",
        );
      }

      const updatedMessage: OperationsMessage = {
        ...message,
        readByAccountIds: [...new Set([...message.readByAccountIds, context.account.id])],
      };
      const nextState: DemoOperationsState = {
        ...state,
        messages: state.messages.map((candidate) => candidate.id === messageId ? updatedMessage : candidate),
        updatedAt: occurredAt,
      };
      return { state: nextState, result: updatedMessage };
    });
  }

  getShipmentEdiTransactions(shipmentId: EntityId): readonly EdiTransaction[] {
    return this.state.ediTransactions.filter((transaction) => transaction.shipmentId === shipmentId);
  }

  /**
   * Availability writes. A driver owns their own calendar; an admin may write
   * anyone's by naming a driver in the input. Conflicts with already-assigned
   * loads are surfaced by the screen, which has both collections in hand —
   * the write itself is never blocked, because a driver telling dispatch they
   * are unavailable is information dispatch needs, not an error.
   */
  setAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const driverId = resolveAvailabilityDriverId(state, context, input.driverId);
      const startsAt = normalizedIsoDateTime(input.startsAt);
      const endsAt = normalizedIsoDateTime(input.endsAt);
      if (Date.parse(endsAt) <= Date.parse(startsAt)) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "An availability block has to end after it starts.",
        );
      }

      const existing = input.id
        ? state.availabilityBlocks.find(
            (candidate) => candidate.id === input.id && candidate.driverId === driverId,
          )
        : undefined;
      if (input.id && !existing) {
        throw new OperationsDomainError("NOT_FOUND", "That availability block could not be found.");
      }

      const block: AvailabilityBlock = {
        createdAt: existing?.createdAt ?? occurredAt,
        driverId,
        endsAt,
        id: existing?.id ?? this.nextId("availability", occurredAt),
        kind: input.kind,
        note: input.note?.trim() || undefined,
        ruleId: existing?.ruleId,
        startsAt,
        updatedAt: occurredAt,
      };

      const others = state.availabilityBlocks.filter((candidate) => candidate.id !== block.id);
      return {
        result: block,
        state: {
          ...state,
          availabilityBlocks: [...others, block],
          updatedAt: occurredAt,
        },
      };
    });
  }

  removeAvailabilityBlock(blockId: EntityId): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const block = state.availabilityBlocks.find((candidate) => candidate.id === blockId);
      if (!block) {
        throw new OperationsDomainError("NOT_FOUND", "That availability block could not be found.");
      }
      resolveAvailabilityDriverId(state, context, block.driverId);

      const nextState: DemoOperationsState = {
        ...state,
        availabilityBlocks: state.availabilityBlocks.filter(
          (candidate) => candidate.id !== blockId,
        ),
        updatedAt: occurredAt,
      };
      return { result: nextState, state: nextState };
    });
  }

  setAvailabilityRule(input: AvailabilityRuleInput): Promise<AvailabilityRule> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const driverId = resolveAvailabilityDriverId(state, context, input.driverId);
      if (
        !Number.isInteger(input.startMinute) ||
        !Number.isInteger(input.endMinute) ||
        input.startMinute < 0 ||
        input.endMinute > 1_440 ||
        input.endMinute <= input.startMinute
      ) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "A weekly pattern has to cover a real span inside one day.",
        );
      }

      const existing = input.id
        ? state.availabilityRules.find(
            (candidate) => candidate.id === input.id && candidate.driverId === driverId,
          )
        : undefined;
      if (input.id && !existing) {
        throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
      }

      const rule: AvailabilityRule = {
        createdAt: existing?.createdAt ?? occurredAt,
        driverId,
        effectiveFrom: normalizedIsoDateTime(input.effectiveFrom),
        effectiveUntil: input.effectiveUntil
          ? normalizedIsoDateTime(input.effectiveUntil)
          : undefined,
        endMinute: input.endMinute,
        id: existing?.id ?? this.nextId("availability-rule", occurredAt),
        kind: input.kind,
        startMinute: input.startMinute,
        updatedAt: occurredAt,
        weekday: input.weekday,
      };

      const others = state.availabilityRules.filter((candidate) => candidate.id !== rule.id);
      return {
        result: rule,
        state: { ...state, availabilityRules: [...others, rule], updatedAt: occurredAt },
      };
    });
  }

  removeAvailabilityRule(ruleId: EntityId): Promise<DemoOperationsState> {
    return this.commit((state, occurredAt) => {
      const context = getSessionContext(state);
      const rule = state.availabilityRules.find((candidate) => candidate.id === ruleId);
      if (!rule) {
        throw new OperationsDomainError("NOT_FOUND", "That weekly pattern could not be found.");
      }
      resolveAvailabilityDriverId(state, context, rule.driverId);

      const nextState: DemoOperationsState = {
        ...state,
        // Blocks expanded from the rule go with it; leaving them behind would
        // keep enforcing a pattern the driver just deleted.
        availabilityBlocks: state.availabilityBlocks.filter(
          (candidate) => candidate.ruleId !== ruleId,
        ),
        availabilityRules: state.availabilityRules.filter((candidate) => candidate.id !== ruleId),
        updatedAt: occurredAt,
      };
      return { result: nextState, state: nextState };
    });
  }

  /**
   * Payout handles. Driver-only and scoped to the signed-in driver — an admin
   * has no read path to a raw handle through this repository at all.
   */
  listPayoutMethods(): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => {
      const context = getSessionContext(this.state);
      requireRole(context, "driver", "A Driver role is required to view payout methods.");
      return this.payoutMethods.list(requireDriverId(context));
    });
  }

  savePayoutMethod(input: PayoutMethodInput): Promise<PayoutMethod> {
    return this.enqueue(async () => {
      const context = getSessionContext(this.state);
      requireRole(context, "driver", "A Driver role is required to save a payout method.");
      return this.payoutMethods.save(requireDriverId(context), input);
    });
  }

  removePayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => {
      const context = getSessionContext(this.state);
      requireRole(context, "driver", "A Driver role is required to remove a payout method.");
      return this.payoutMethods.remove(requireDriverId(context), methodId);
    });
  }

  setDefaultPayoutMethod(methodId: EntityId): Promise<readonly PayoutMethod[]> {
    return this.enqueue(async () => {
      const context = getSessionContext(this.state);
      requireRole(context, "driver", "A Driver role is required to change the default payout.");
      return this.payoutMethods.setDefault(requireDriverId(context), methodId);
    });
  }

  upsertVehicle(input: VehicleInput): Promise<Vehicle> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to manage the fleet.",
      );
      const existing = input.id
        ? state.vehicles.find((candidate) => candidate.id === input.id)
        : undefined;
      if (input.id && !existing) {
        throw new OperationsDomainError("NOT_FOUND", "That vehicle could not be found.");
      }

      const unitNumber = input.unitNumber.trim();
      if (unitNumber.length === 0) {
        throw new OperationsDomainError("VALIDATION_FAILED", "A vehicle needs a unit number.");
      }
      // Unit numbers are how the shop, the driver, and dispatch all refer to
      // the same truck, so two units may never share one.
      const duplicate = state.vehicles.find(
        (candidate) => candidate.id !== existing?.id &&
          candidate.unitNumber.toLowerCase() === unitNumber.toLowerCase(),
      );
      if (duplicate) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          `Unit ${unitNumber} is already in the fleet.`,
        );
      }
      if (input.assignedDriverId) {
        findDriver(state, input.assignedDriverId);
      }

      const vehicle: Vehicle = {
        assignedDriverId: input.assignedDriverId,
        createdAt: existing?.createdAt ?? occurredAt,
        id: existing?.id ?? this.nextId("vehicle", occurredAt),
        make: input.make,
        model: input.model,
        odometerMiles: Math.max(0, Math.round(input.odometerMiles)),
        plateNumber: input.plateNumber,
        plateState: input.plateState,
        status: input.status,
        type: input.type,
        unitNumber,
        updatedAt: occurredAt,
        vin: input.vin.trim().toUpperCase(),
        year: input.year,
      };

      const others = state.vehicles.filter((candidate) => candidate.id !== vehicle.id);
      return {
        result: vehicle,
        state: { ...state, updatedAt: occurredAt, vehicles: [...others, vehicle] },
      };
    });
  }

  assignVehicle(vehicleId: EntityId, driverId: EntityId | null): Promise<Vehicle> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to assign a vehicle.",
      );
      const vehicle = findVehicle(state, vehicleId);
      if (driverId) {
        findDriver(state, driverId);
        // A tractor in the shop cannot be handed to a driver who would then be
        // dispatched on it.
        if (vehicle.status === "in_shop" || vehicle.status === "out_of_service") {
          throw new OperationsDomainError(
            "VALIDATION_FAILED",
            `Unit ${vehicle.unitNumber} is ${vehicle.status === "in_shop" ? "in the shop" : "out of service"} and cannot be assigned.`,
          );
        }
      }

      const updated: Vehicle = {
        ...vehicle,
        assignedDriverId: driverId ?? undefined,
        updatedAt: occurredAt,
      };
      return {
        result: updated,
        state: {
          ...state,
          updatedAt: occurredAt,
          vehicles: state.vehicles.map((candidate) => candidate.id === updated.id ? updated : candidate),
        },
      };
    });
  }

  createMaintenanceOrder(input: MaintenanceOrderInput): Promise<MaintenanceOrder> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to open a work order.",
      );
      const vehicle = findVehicle(state, input.vehicleId);
      if (input.reportedByDriverId) {
        findDriver(state, input.reportedByDriverId);
      }

      const order: MaintenanceOrder = {
        costCents: input.costCents,
        description: input.description,
        id: this.nextId("maintenance", occurredAt),
        kind: input.kind,
        odometerMiles: input.odometerMiles ?? vehicle.odometerMiles,
        openedAt: occurredAt,
        reportedByDriverId: input.reportedByDriverId,
        scheduledFor: input.scheduledFor ? normalizedIsoDateTime(input.scheduledFor) : undefined,
        severity: input.severity,
        status: input.scheduledFor ? "scheduled" : "open",
        summary: input.summary,
        updatedAt: occurredAt,
        vehicleId: vehicle.id,
        vendorName: input.vendorName,
      };

      // A critical repair takes the unit off the board and off its driver, so
      // the fleet screen and the dispatch board cannot disagree about whether
      // the truck can run.
      const grounded = order.severity === "critical";
      return {
        result: order,
        state: {
          ...state,
          maintenanceOrders: [...state.maintenanceOrders, order],
          updatedAt: occurredAt,
          vehicles: grounded
            ? state.vehicles.map((candidate) => candidate.id === vehicle.id
                ? { ...candidate, assignedDriverId: undefined, status: "out_of_service" as const, updatedAt: occurredAt }
                : candidate)
            : state.vehicles,
        },
      };
    });
  }

  updateMaintenanceOrder(
    orderId: EntityId,
    patch: MaintenanceOrderPatch,
  ): Promise<MaintenanceOrder> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to update a work order.",
      );
      const order = state.maintenanceOrders.find((candidate) => candidate.id === orderId);
      if (!order) {
        throw new OperationsDomainError("NOT_FOUND", "That work order could not be found.");
      }
      if (order.status === "completed" || order.status === "cancelled") {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "A closed work order cannot be changed. Open a new one instead.",
        );
      }

      const status = patch.status ?? order.status;
      const updated: MaintenanceOrder = {
        ...order,
        completedAt: status === "completed"
          ? patch.completedAt ? normalizedIsoDateTime(patch.completedAt) : occurredAt
          : order.completedAt,
        costCents: patch.costCents ?? order.costCents,
        description: patch.description ?? order.description,
        scheduledFor: patch.scheduledFor
          ? normalizedIsoDateTime(patch.scheduledFor)
          : order.scheduledFor,
        severity: patch.severity ?? order.severity,
        status,
        updatedAt: occurredAt,
        vendorName: patch.vendorName ?? order.vendorName,
      };

      // Closing the last open order on a unit puts it back in service.
      const stillDown = state.maintenanceOrders.some(
        (candidate) => candidate.vehicleId === order.vehicleId &&
          candidate.id !== order.id &&
          candidate.status !== "completed" &&
          candidate.status !== "cancelled",
      );
      const releaseVehicle = (status === "completed" || status === "cancelled") && !stillDown;

      return {
        result: updated,
        state: {
          ...state,
          maintenanceOrders: state.maintenanceOrders.map(
            (candidate) => candidate.id === updated.id ? updated : candidate,
          ),
          updatedAt: occurredAt,
          vehicles: releaseVehicle
            ? state.vehicles.map((candidate) => candidate.id === order.vehicleId && candidate.status !== "retired"
                ? { ...candidate, status: "active" as const, updatedAt: occurredAt }
                : candidate)
            : state.vehicles,
        },
      };
    });
  }

  upsertComplianceDocument(input: ComplianceDocumentInput): Promise<ComplianceDocument> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to record a compliance document.",
      );
      if (input.subjectType === "vehicle") {
        findVehicle(state, input.subjectId);
      } else {
        findDriver(state, input.subjectId);
      }

      const issuedOn = normalizedIsoDateTime(input.issuedOn);
      const expiresOn = normalizedIsoDateTime(input.expiresOn);
      if (Date.parse(expiresOn) <= Date.parse(issuedOn)) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "A document has to expire after it was issued.",
        );
      }

      const existing = input.id
        ? state.complianceDocuments.find((candidate) => candidate.id === input.id)
        : state.complianceDocuments.find(
            (candidate) => candidate.subjectId === input.subjectId && candidate.kind === input.kind,
          );

      const document: ComplianceDocument = {
        expiresOn,
        id: existing?.id ?? this.nextId("compliance", occurredAt),
        identifier: input.identifier,
        issuedOn,
        issuingState: input.issuingState,
        kind: input.kind,
        subjectId: input.subjectId,
        subjectType: input.subjectType,
        updatedAt: occurredAt,
      };

      const others = state.complianceDocuments.filter((candidate) => candidate.id !== document.id);
      return {
        result: document,
        state: {
          ...state,
          complianceDocuments: [...others, document],
          updatedAt: occurredAt,
        },
      };
    });
  }

  issuePayout(
    driverId: EntityId,
    periodStart: IsoDateTime,
    periodEnd: IsoDateTime,
  ): Promise<Payout> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to issue a settlement.",
      );
      findDriver(state, driverId);
      const start = normalizedIsoDateTime(periodStart);
      const end = normalizedIsoDateTime(periodEnd);
      if (Date.parse(end) <= Date.parse(start)) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "A settlement period has to end after it starts.",
        );
      }

      // Two settlements covering one delivery would pay for it twice.
      const overlapping = state.payouts.find(
        (candidate) => candidate.driverId === driverId &&
          candidate.status !== "failed" &&
          Date.parse(candidate.periodStart) < Date.parse(end) &&
          Date.parse(candidate.periodEnd) > Date.parse(start),
      );
      if (overlapping) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "That period overlaps a settlement this driver already has.",
        );
      }

      const lineItems = buildPayoutLineItems({
        driverId,
        nextId: (prefix) => this.nextId(prefix, occurredAt),
        periodEnd: end,
        periodStart: start,
        shipments: state.shipments,
      });
      if (lineItems.length === 0) {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "That period has no delivered loads to settle.",
        );
      }

      const totals = summarizePayout(lineItems);
      const payout: Payout = {
        createdAt: occurredAt,
        deductionCents: totals.deductionCents,
        driverId,
        grossCents: totals.grossCents,
        id: this.nextId("payout", occurredAt),
        issuedAt: occurredAt,
        lineItems,
        netCents: totals.netCents,
        periodEnd: end,
        periodStart: start,
        status: "pending",
        updatedAt: occurredAt,
      };

      return {
        result: payout,
        state: { ...state, payouts: [...state.payouts, payout], updatedAt: occurredAt },
      };
    });
  }

  /**
   * Records that a settlement was paid on a rail. This moves no money and
   * contacts nothing; it is the ledger catching up with a transfer that
   * happened in the driver's own payment app.
   */
  markPayoutPaid(payoutId: EntityId, rail: PayoutRail): Promise<Payout> {
    return this.commit((state, occurredAt) => {
      requireRole(
        getSessionContext(state),
        "admin",
        "An Admin role is required to record a settlement as paid.",
      );
      const payout = state.payouts.find((candidate) => candidate.id === payoutId);
      if (!payout) {
        throw new OperationsDomainError("NOT_FOUND", "That settlement could not be found.");
      }
      if (payout.status === "paid") {
        throw new OperationsDomainError(
          "VALIDATION_FAILED",
          "That settlement is already recorded as paid.",
        );
      }

      const updated: Payout = {
        ...payout,
        paidAt: occurredAt,
        // The rail, never the handle. An admin reconciling a settlement needs
        // to know it went out over Venmo; they have no business knowing which
        // Venmo account, and no read path to one.
        rail,
        status: "paid",
        updatedAt: occurredAt,
      };
      return {
        result: updated,
        state: {
          ...state,
          payouts: state.payouts.map((candidate) => candidate.id === updated.id ? updated : candidate),
          updatedAt: occurredAt,
        },
      };
    });
  }

  private commit<Result>(
    update: (state: DemoOperationsState, occurredAt: string) => StateUpdate<Result>,
  ): Promise<Result> {
    return this.enqueue(async () => {
      const occurredAt = normalizedIsoDateTime(this.clock());
      const next = update(this.state, occurredAt);
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

function getSessionContext(state: DemoOperationsState): SessionContext {
  const account = state.accounts.find((candidate) => candidate.id === state.session.accountId);
  if (!account || !state.session.effectiveRole) {
    throw new OperationsDomainError("UNAUTHORIZED", "Sign in to use this demo action.");
  }

  const effectiveRole = state.session.effectiveRole;
  const customerId = effectiveRole === "customer"
    ? account.customerId ?? state.customers[0]?.id
    : undefined;
  const driverId = effectiveRole === "driver"
    ? account.driverId ?? state.drivers[0]?.id
    : undefined;

  return { account, effectiveRole, customerId, driverId };
}

function requireRole(context: SessionContext, role: AppRole, safeMessage: string): void {
  if (context.effectiveRole !== role) {
    throw new OperationsDomainError("UNAUTHORIZED", safeMessage);
  }
}

function requireCustomerId(context: SessionContext): EntityId {
  if (!context.customerId) {
    throw new OperationsDomainError("NOT_FOUND", "The demo customer could not be found.");
  }
  return context.customerId;
}

function requireDriverId(context: SessionContext): EntityId {
  if (!context.driverId) {
    throw new OperationsDomainError("NOT_FOUND", "The demo driver could not be found.");
  }
  return context.driverId;
}

/**
 * Whose calendar this write lands on. A driver only ever writes their own, and
 * naming somebody else is refused rather than silently redirected — a screen
 * that sent the wrong driverId should fail loudly, not edit the wrong person.
 */
function resolveAvailabilityDriverId(
  state: DemoOperationsState,
  context: SessionContext,
  requestedDriverId: EntityId | undefined,
): EntityId {
  if (context.effectiveRole === "admin") {
    const driverId = requestedDriverId ?? state.drivers[0]?.id;
    if (!driverId) {
      throw new OperationsDomainError("NOT_FOUND", "No driver was named for this calendar.");
    }
    findDriver(state, driverId);
    return driverId;
  }

  requireRole(context, "driver", "A Driver or Admin role is required to change availability.");
  const driverId = requireDriverId(context);
  if (requestedDriverId && requestedDriverId !== driverId) {
    throw new OperationsDomainError(
      "UNAUTHORIZED",
      "A driver can only change their own availability.",
    );
  }
  return driverId;
}

function findDriver(state: DemoOperationsState, driverId: EntityId): Driver {
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  if (!driver) {
    throw new OperationsDomainError("NOT_FOUND", "The driver could not be found.", { driverId });
  }
  return driver;
}

function findVehicle(state: DemoOperationsState, vehicleId: EntityId): Vehicle {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) {
    throw new OperationsDomainError("NOT_FOUND", "The vehicle could not be found.", { vehicleId });
  }
  return vehicle;
}

function findShipment(state: DemoOperationsState, shipmentId: EntityId): Shipment {
  const shipment = state.shipments.find((candidate) => candidate.id === shipmentId);
  if (!shipment) {
    throw new OperationsDomainError("NOT_FOUND", "The shipment could not be found.", { shipmentId });
  }
  return shipment;
}

function assertCanOperateShipment(context: SessionContext, shipment: Shipment): void {
  if (context.effectiveRole === "admin") {
    return;
  }
  if (context.effectiveRole === "driver" && shipment.assignedDriverId === context.driverId) {
    return;
  }
  throw new OperationsDomainError(
    "UNAUTHORIZED",
    "This role cannot update the selected shipment.",
    { shipmentId: shipment.id },
  );
}

function replaceShipment(
  state: DemoOperationsState,
  shipment: Shipment,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    shipments: state.shipments.map((candidate) => candidate.id === shipment.id ? shipment : candidate),
    updatedAt: occurredAt,
  };
}

function assertDriverAssignable(
  state: DemoOperationsState,
  shipment: Shipment,
  driverId: EntityId,
): void {
  const driver = state.drivers.find((candidate) => candidate.id === driverId);
  if (!driver) {
    throw new OperationsDomainError("NOT_FOUND", "The selected driver could not be found.");
  }
  if (driver.status === "suspended") {
    throw new OperationsDomainError("VALIDATION_FAILED", "The selected driver is suspended.");
  }
  const conflict = state.shipments.find((candidate) =>
    candidate.id !== shipment.id
    && candidate.assignedDriverId === driverId
    && RESERVED_SHIPMENT_STATUSES.has(candidate.status));
  if (conflict) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `The selected driver is already assigned to ${conflict.loadNumber}.`,
      { shipmentId: conflict.id, driverId },
    );
  }
}

function appendEdiTransaction(
  state: DemoOperationsState,
  transaction: EdiTransaction,
  occurredAt: string,
): DemoOperationsState {
  return {
    ...state,
    ediTransactions: [...state.ediTransactions, transaction],
    updatedAt: occurredAt,
  };
}

function createEdiTransaction(
  id: string,
  shipment: Shipment,
  transactionType: EdiTransactionType,
  summary: string,
  occurredAt: string,
): EdiTransaction {
  return {
    id,
    shipmentId: shipment.id,
    transactionType,
    direction: "outbound",
    status: "generated",
    senderId: "MFS-DEMO",
    receiverId: "SHIPPER-DEMO",
    controlNumber: id.replace(/\D/g, "").slice(-12).padStart(12, "0"),
    summary,
    createdAt: occurredAt,
    isSimulated: true,
  };
}

function currentCoordinates(
  state: DemoOperationsState,
  context: SessionContext,
): GeoPoint | undefined {
  return context.driverId
    ? state.drivers.find((driver) => driver.id === context.driverId)?.currentLocation
    : undefined;
}

function eventSourceForRole(role: AppRole): ShipmentEventSource {
  return role;
}

function isOperationalStatus(status: ShipmentStatus): boolean {
  return status === "dispatched" || ACTIVE_SHIPMENT_STATUSES.has(status) || status === "cancelled";
}

function validateCoordinates(coordinates: GeoPoint): void {
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "The GPS coordinates are invalid.",
    );
  }
}

function requireTrimmedText(
  value: string,
  fieldName: string,
  minimumLength: number,
  maximumLength: number,
): void {
  const length = value.trim().length;
  if (length < minimumLength || length > maximumLength) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `${fieldName} must be between ${minimumLength} and ${maximumLength} characters.`,
      { fieldName, minimumLength, maximumLength },
    );
  }
}

function normalizedIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "The demo clock returned an invalid date and time.",
    );
  }
  return date.toISOString();
}
