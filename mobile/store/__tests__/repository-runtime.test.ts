import { describe, expect, it, jest } from "@jest/globals";

import { createDemoOperationsState } from "../../domain/fixtures";
import type {
  DemoOperationsState,
  OperationsAccount,
} from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import { ApiClient } from "../../lib/network";
import { MemoryOfflineQueueStorage, OfflineMutationQueue } from "../../lib/offline";
import { ProductionOperationsRepository } from "../ProductionOperationsRepository";
import { createOperationsRepositoryFromEnvironment } from "../repositoryFactory";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => undefined),
    setItem: jest.fn(async () => undefined),
  },
}));

describe("operations repository selection", () => {
  it("selects only explicitly enabled demo mode and otherwise fails closed", async () => {
    expect(createOperationsRepositoryFromEnvironment({
      environment: { EXPO_PUBLIC_DEMO_AUTH_ENABLED: "true" },
    }).mode).toBe("demo");
    const unconfigured = createOperationsRepositoryFromEnvironment({ environment: {} });
    expect(unconfigured.mode).toBe("unconfigured");
    await expect(unconfigured.hydrate()).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });
});

describe("ProductionOperationsRepository", () => {
  it("hydrates production data and queues driver, location, exception, photo, signature, and POD writes", async () => {
    const state = productionState("driver");
    const identity = identityFor("driver", "account-driver");
    const captured: CapturedCalls = { mutations: [], onlineWrites: [] };
    const fetchImplementation = createApiFetch(state, captured);
    const queue = new OfflineMutationQueue({
      idempotencyKeyFactory: createIdFactory(),
      storage: new MemoryOfflineQueueStorage(),
    });
    const repository = new ProductionOperationsRepository({
      apiClient: new ApiClient({
        baseUrl: "https://api.example.com",
        fetchImplementation,
        getAccessToken: async () => "access-token",
        requestIdFactory: createIdFactory(),
        sleep: async () => undefined,
      }),
      auth: {
        getCurrentIdentity: async () => identity,
        signIn: async () => identity,
        signOut: async () => undefined,
      },
      clock: () => "2026-08-21T13:00:00.000Z",
      fetchImplementation,
      idFactory: createIdFactory(),
      offlineQueue: queue,
      uploadBaseUrl: "https://storage.example.com",
    });

    await repository.hydrate();
    await repository.signIn("driver@example.com", "correct horse battery staple");
    await repository.transitionDutyStatus("driving");
    expect(repository.getState().hosClocks[0]?.status).toBe("driving");
    await repository.recordDriverLocation({ latitude: 44.1, longitude: -93.2 });
    const report = await repository.reportException("shipment-28471", {
      attachmentUris: ["file://damage.jpg"],
      category: "cargo_damage",
      description: "One pallet wrap is torn.",
      severity: "medium",
    });
    const proof = await repository.submitProofOfDelivery("shipment-28471", {
      attachments: [{ kind: "photo", name: "Delivery", uri: "file://delivery.jpg" }],
      notes: "Received",
      recipientName: "Receiver",
      signatureData: "file://signature.svg",
      stopId: "stop-28471-delivery",
    });
    await repository.syncOfflineMutations();

    expect(report.id).toMatch(/^id-/);
    expect(proof.status).toBe("submitted");
    expect(await queue.list()).toEqual([]);
    expect(captured.mutations.map((mutation) => mutation.operation)).toEqual([
      "driver.duty_status.update",
      "driver.location.record",
      "shipment.photo.attach",
      "shipment.exception.report",
      "shipment.photo.attach",
      "shipment.signature.record",
      "shipment.pod.submit",
    ]);
    expect(captured.mutations[2]?.payload).toEqual({
      documentId: "document-damage.jpg",
      shipmentId: "shipment-28471",
    });
    expect(repository.getShipmentEdiTransactions("shipment-28471")).toEqual([]);
    await repository.signOut();
    expect(repository.getState().session.accountId).toBeNull();
  });

  it("keeps admin-only online mutations separate from demo role controls", async () => {
    const state = productionState("admin");
    const identity = identityFor("admin", "account-admin");
    const captured: CapturedCalls = { mutations: [], onlineWrites: [] };
    const repository = new ProductionOperationsRepository({
      apiClient: new ApiClient({
        baseUrl: "https://api.example.com",
        fetchImplementation: createApiFetch(state, captured),
        getAccessToken: async () => "access-token",
        requestIdFactory: createIdFactory(),
        sleep: async () => undefined,
      }),
      auth: {
        getCurrentIdentity: async () => identity,
        signIn: async () => identity,
        signOut: async () => undefined,
      },
      idFactory: createIdFactory(),
      offlineQueue: new OfflineMutationQueue({
        idempotencyKeyFactory: createIdFactory(),
        storage: new MemoryOfflineQueueStorage(),
      }),
    });
    await repository.hydrate();
    await repository.respondToTender("shipment-28492", "accepted");
    await repository.assignShipment("shipment-28492", "driver-brenna");
    const dispatched = await repository.transitionShipment("shipment-28492", "dispatched");
    expect(dispatched.status).toBe("dispatched");
    expect(captured.mutations.map(({ operation, payload }) => ({ operation, payload }))).toEqual([
      {
        operation: "shipment.status.update",
        payload: { shipmentId: "shipment-28492", status: "dispatched" },
      },
    ]);
    const resolved = await repository.resolveException(
      state.exceptions[0]?.id ?? "exception-delay",
      "Gate cleared and driver released.",
      "dispatched",
    );
    expect(resolved.status).toBe("resolved");
    await repository.sendMessage({
      body: "Update",
      recipientAccountIds: ["account-driver"],
      threadId: state.messages[0]?.threadId ?? "thread-dispatch",
      threadKind: "dispatch",
    });
    await repository.markMessageRead(state.messages[0]?.id ?? "message-1");
    await repository.createCustomerRequest({
      destination: { addressLine1: "200 Market St", city: "Loveland", postalCode: "80537", state: "CO" },
      details: "Pickup two pallets on Friday morning.",
      origin: { addressLine1: "100 Crossdock Rd", city: "Aurora", postalCode: "80011", state: "CO" },
      subject: "Friday pickup",
      type: "pickup",
    });
    expect(captured.onlineWrites).toEqual([
      "/v1/shipments/shipment-28492/tender-response",
      "/v1/shipments/shipment-28492/assignment",
      `/v1/exceptions/${state.exceptions[0]?.id ?? "exception-delay"}/resolution`,
      "/v1/messages",
      `/v1/messages/${state.messages[0]?.id ?? "message-1"}/read`,
      "/v1/requests",
    ]);

    // Surfaces with no production backing must fail closed, never post to a
    // prototype URL that does not exist on the server.
    await expect(
      repository.advanceIntermediateStop("shipment-28471", "stop-28471-intermediate"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      repository.createCustomerRequest({ details: "Pickup", subject: "Pickup", type: "pickup" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(repository.switchDemoRole("driver")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(repository.resetDemo()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("hydrates a pending customer from freight requests only, never from bootstrap", async () => {
    const state = productionState("admin");
    const identity: AuthIdentity = {
      accessState: "pending_customer_approval",
      carrierId: null,
      customerAccountId: null,
      driverId: null,
      email: "pending@northline.example.com",
      mfa: { currentLevel: "aal1", factors: [], nextLevel: "aal1", status: "unenrolled" },
      organizationId: "organization-mf",
      organizationSlug: "mf-superior",
      role: "customer",
      userId: "user-pending",
    };
    const requestedPaths: string[] = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requestedPaths.push(new URL(input.toString()).pathname);
      return createApiFetch(state)(input, init);
    };
    const repository = new ProductionOperationsRepository({
      apiClient: new ApiClient({
        baseUrl: "https://api.example.com",
        fetchImplementation,
        getAccessToken: async () => "access-token",
        requestIdFactory: createIdFactory(),
        sleep: async () => undefined,
      }),
      auth: {
        getCurrentIdentity: async () => identity,
        signIn: async () => identity,
        signOut: async () => undefined,
      },
      clock: () => "2026-08-21T13:00:00.000Z",
      idFactory: createIdFactory(),
      offlineQueue: new OfflineMutationQueue({
        idempotencyKeyFactory: createIdFactory(),
        storage: new MemoryOfflineQueueStorage(),
      }),
    });

    const hydrated = await repository.hydrate();
    expect(hydrated.state.session.accessState).toBe("pending_customer_approval");
    expect(hydrated.state.session.effectiveRole).toBe("customer");
    expect(hydrated.state.shipments).toEqual([]);
    expect(hydrated.state.drivers).toEqual([]);
    expect(hydrated.state.requests.length).toBeGreaterThan(0);
    expect(requestedPaths.some((path) => path.includes("/v1/bootstrap"))).toBe(false);
    expect(requestedPaths.some((path) => path.includes("/v1/shipments"))).toBe(false);
    expect(requestedPaths.filter((path) => path.includes("/v1/requests")).length).toBe(1);
  });
});

function productionState(role: "admin" | "driver"): DemoOperationsState {
  const fixture = createDemoOperationsState();
  const accountId = role === "admin" ? "account-admin" : "account-driver";
  return {
    ...fixture,
    accounts: fixture.accounts.map(withoutDemoPin),
    session: { accountId, effectiveRole: role },
  };
}

function withoutDemoPin(account: OperationsAccount): OperationsAccount {
  return {
    companyName: account.companyName,
    customerId: account.customerId,
    displayName: account.displayName,
    driverId: account.driverId,
    email: account.email,
    id: account.id,
    role: account.role,
    title: account.title,
  };
}

function identityFor(role: "admin" | "driver", userId: string): AuthIdentity {
  return {
    accessState: "active",
    carrierId: "carrier-1",
    customerAccountId: null,
    driverId: role === "driver" ? "driver-brenna" : null,
    email: `${role}@demo.mfsuperior.com`,
    mfa: { currentLevel: "aal2", factors: [], nextLevel: "aal2", status: "verified" },
    organizationId: "organization-1",
    organizationSlug: "mf-superior",
    role,
    userId,
  };
}

interface CapturedCalls {
  readonly mutations: { operation: string; payload: Record<string, unknown> }[];
  readonly onlineWrites: string[];
}

function createApiFetch(
  state: DemoOperationsState,
  captured?: CapturedCalls,
): typeof fetch {
  return async (input, init) => {
    const url = input.toString();
    const method = init?.method ?? "GET";
    if (url.startsWith("file://")) {
      return {
        blob: async () => ({ size: 18 }) as unknown as Blob,
        json: async () => ({}),
        ok: true,
        status: 200,
      } as Response;
    }
    if (method === "PUT" || url.includes("/storage/")) {
      return jsonResponse({});
    }
    if (method === "GET") {
      if (url.includes("/v1/bootstrap")) return jsonResponse(envelope(bootstrapPayload(state)));
      if (url.includes("/v1/shipments")) return jsonResponse(envelope(shipmentPayload(state)));
      if (url.includes("/v1/requests")) return jsonResponse(envelope(requestPayload(state)));
      if (url.includes("/v1/exceptions")) return jsonResponse(envelope(exceptionPayload(state)));
      if (url.includes("/v1/messages")) return jsonResponse(envelope(messagePayload(state)));
      // Fleet, calendar, shop, compliance, and settlement reads. An empty list
      // is what a freshly provisioned carrier actually returns, and it keeps
      // these out of the online-write capture below.
      if (
        url.includes("/v1/availability") ||
        url.includes("/v1/vehicles") ||
        url.includes("/v1/maintenance") ||
        url.includes("/v1/compliance") ||
        url.includes("/v1/payouts")
      ) {
        return jsonResponse(envelope([]));
      }
    }
    if (url.endsWith("/v1/documents/upload-intent")) {
      const body = JSON.parse(String(init?.body)) as { contentType: string; fileName: string };
      return jsonResponse(envelope({
        documentId: `document-${body.fileName}`,
        upload: {
          contentType: body.contentType,
          expiresAt: "2026-08-21T13:02:00.000Z",
          token: "upload-token",
          url: "https://storage.example.com/storage/v1/object/upload/sign/docs/path",
        },
      }));
    }
    if (url.endsWith("/v1/mutations")) {
      const body = JSON.parse(String(init?.body)) as {
        mutations: { idempotencyKey: string; operation: string; payload: Record<string, unknown> }[];
      };
      captured?.mutations.push(...body.mutations);
      return jsonResponse(envelope({
        results: body.mutations.map((mutation) => ({
          idempotencyKey: mutation.idempotencyKey,
          operation: mutation.operation,
          replayed: false,
          result: { id: "result-id" },
        })),
      }));
    }
    captured?.onlineWrites.push(new URL(url).pathname);
    return jsonResponse(envelope(resultForPath(state, url)));
  };
}

function bootstrapPayload(state: DemoOperationsState) {
  const account = state.accounts.find(({ id }) => id === state.session.accountId) ?? state.accounts[0];
  if (!account) throw new Error("A test account is required.");
  return {
    integrations: state.integrations.map((integration) => ({
      lastSucceededAt: integration.lastCheckedAt,
      provider: integration.name,
      status: integration.status,
    })),
    organization: { id: "organization-mf", name: account.companyName },
    referenceData: {
      drivers: state.drivers.map((driver) => ({
        currentLat: String(driver.currentLocation.latitude),
        currentLng: String(driver.currentLocation.longitude),
        email: driver.email,
        firstName: driver.firstName,
        id: driver.id,
        lastName: driver.lastName,
        licenseNumber: driver.licenseNumber,
        licenseState: driver.licenseState,
        locationUpdatedAt: driver.locationUpdatedAt,
        phone: driver.phone,
        status: driver.status,
      })),
    },
    user: {
      customerAccountId: account.customerId ?? null,
      displayName: account.displayName,
      driverId: account.driverId ?? null,
      email: account.email,
      id: account.id,
      role: account.role,
    },
  };
}

function shipmentPayload(state: DemoOperationsState) {
  return state.shipments.map((shipment) => ({
    bolNumber: shipment.billOfLadingNumber,
    commodity: shipment.commodity,
    destination: shipment.stops.at(-1)?.address ?? {},
    driverId: shipment.assignedDriverId ?? null,
    equipmentType: shipment.equipmentType,
    estimatedDeliveryAt: shipment.stops.at(-1)?.appointment.startsAt ?? null,
    estimatedPickupAt: shipment.stops[0]?.appointment.startsAt ?? null,
    id: shipment.id,
    loadNumber: shipment.loadNumber,
    origin: shipment.stops[0]?.address ?? {},
    palletCount: shipment.palletCount,
    proNumber: shipment.proNumber,
    specialInstructions: shipment.specialInstructions,
    status: shipment.status === "loaded" || shipment.status === "declined" ? "exception" : shipment.status,
    updatedAt: shipment.updatedAt,
    weightLbs: shipment.weightPounds,
  }));
}

function requestPayload(state: DemoOperationsState) {
  return state.requests.map((request) => ({
    commodity: request.subject,
    createdAt: request.requestedAt,
    customerAccountId: request.customerId,
    equipmentType: null,
    id: request.id,
    notes: request.details,
    referenceNumber: request.subject,
    shipmentId: request.shipmentId ?? null,
    status: request.status === "scheduled" ? "booked" : request.status === "closed" ? "cancelled" : request.status,
    updatedAt: request.updatedAt,
  }));
}

function envelope(data: unknown) {
  return { data, error: null, meta: { requestId: "server-request" } };
}

function resultForPath(state: DemoOperationsState, url: string): unknown {
  if (url.includes("/exceptions/")) return { id: state.exceptions[0]?.id ?? "exception-1" };
  if (url.includes("/v1/messages")) return { id: state.messages[0]?.id ?? "message-1" };
  if (url.includes("/v1/requests")) return { id: state.requests[0]?.id ?? "request-1" };
  return { driverId: "driver-brenna", id: state.shipments[0]?.id ?? "shipment-1" };
}

function exceptionPayload(state: DemoOperationsState) {
  return state.exceptions.map((report) => ({
    category: report.category,
    description: report.description,
    id: report.id,
    photoUrls: report.attachmentUris,
    reportedAt: report.reportedAt,
    reportedByDriverId: null,
    resolutionNote: report.resolutionNote ?? null,
    resolvedAt: report.resolvedAt ?? null,
    severity: report.severity,
    shipmentId: report.shipmentId,
    status: report.status === "resolved" ? "resolved" : "open",
  }));
}

function messagePayload(state: DemoOperationsState) {
  return state.messages.map((message) => ({
    body: message.body,
    id: message.id,
    readByUserIds: message.readByAccountIds,
    recipientUserIds: message.recipientAccountIds,
    senderUserId: message.senderAccountId,
    sentAt: message.sentAt,
    shipmentId: message.shipmentId ?? null,
    threadKey: message.threadId,
    threadKind: message.threadKind,
  }));
}

function jsonResponse(body: unknown): Response {
  return { json: async () => body, ok: true, status: 200 } as Response;
}

function createIdFactory(): () => string {
  let sequence = 0;
  return () => `id-${sequence += 1}`;
}
