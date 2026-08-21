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
    const fetchImplementation = createApiFetch(state);
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
      idFactory: createIdFactory(),
      offlineQueue: queue,
    });

    await repository.hydrate();
    await repository.signIn("driver@example.com", "correct horse battery staple");
    await repository.transitionDutyStatus("driving");
    expect(repository.getState().hosClocks[0]?.status).toBe("driving");
    await repository.simulateDriverLocation({ latitude: 44.1, longitude: -93.2 });
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
    expect(repository.getShipmentEdiTransactions("shipment-28471").length).toBeGreaterThan(0);
    await repository.signOut();
    expect(repository.getState().session.accountId).toBeNull();
  });

  it("keeps admin-only online mutations separate from demo role controls", async () => {
    const state = productionState("admin");
    const identity = identityFor("admin", "account-admin");
    const repository = new ProductionOperationsRepository({
      apiClient: new ApiClient({
        baseUrl: "https://api.example.com",
        fetchImplementation: createApiFetch(state),
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
      offlineQueue: new OfflineMutationQueue(),
    });
    await repository.hydrate();
    await repository.respondToTender("shipment-28492", "accepted");
    await repository.assignShipment("shipment-28492", "driver-brenna");
    await repository.transitionShipment("shipment-28492", "dispatched");
    await repository.advanceIntermediateStop("shipment-28471", "stop-28471-intermediate");
    await repository.resolveException("exception-delay", "Resolved", "dispatched");
    await repository.sendMessage({
      body: "Update",
      recipientAccountIds: ["account-driver"],
      threadId: "thread-dispatch",
      threadKind: "dispatch",
    });
    await repository.createCustomerRequest({ details: "Pickup", subject: "Pickup", type: "pickup" });
    await repository.markMessageRead("message-1");
    await expect(repository.switchDemoRole("driver")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(repository.resetDemo()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
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
    email: `${role}@example.com`,
    mfa: { currentLevel: "aal2", factors: [], nextLevel: "aal2", status: "verified" },
    role,
    userId,
  };
}

function createApiFetch(state: DemoOperationsState): typeof fetch {
  return async (input, init) => {
    const url = input.toString();
    if ((init?.method ?? "GET") === "GET") {
      return jsonResponse(state);
    }
    if (url.endsWith("/offline-mutations")) {
      return jsonResponse({ accepted: true });
    }
    return jsonResponse({ result: resultForPath(state, url), state });
  };
}

function resultForPath(state: DemoOperationsState, url: string): unknown {
  if (url.includes("/exceptions/")) return state.exceptions[0];
  if (url.includes("/messages")) return state.messages[0];
  if (url.includes("/customer-requests")) return state.requests[0];
  return state.shipments[0];
}

function jsonResponse(body: unknown): Response {
  return { json: async () => body, ok: true, status: 200 } as Response;
}

function createIdFactory(): () => string {
  let sequence = 0;
  return () => `id-${sequence += 1}`;
}
