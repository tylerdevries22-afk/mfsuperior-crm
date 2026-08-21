import { describe, expect, it, jest } from "@jest/globals";
import type { AsyncStorageStatic } from "@react-native-async-storage/async-storage";

import { NetworkRequestError } from "../../network";
import { deserializeOfflineQueue, OfflineMutationQueue } from "../queue";
import { AsyncOfflineQueueStorage, MemoryOfflineQueueStorage } from "../storage";
import type { OfflineMutationDraft, PendingFileRetention } from "../types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => undefined),
    setItem: jest.fn(async () => undefined),
  },
}));

function draft(
  shipmentId: string,
  ownerUserId = "user-1",
  pendingFileUris: readonly string[] = [],
): OfflineMutationDraft {
  return {
    entityId: shipmentId,
    entityVersion: 4,
    kind: "location",
    ownerUserId,
    payload: { coordinates: { latitude: 44.9, longitude: -93.1 } },
    pendingFileUris,
    shipmentId,
  };
}

describe("offline queue storage", () => {
  it("reads, writes, and clears both memory and AsyncStorage adapters", async () => {
    const memory = new MemoryOfflineQueueStorage();
    await memory.write("saved");
    expect(await memory.read()).toBe("saved");
    await memory.clear();
    expect(await memory.read()).toBeNull();

    const values = new Map<string, string>();
    const asyncStorage = {
      getItem: async (key: string) => values.get(key) ?? null,
      removeItem: async (key: string) => { values.delete(key); },
      setItem: async (key: string, value: string) => { values.set(key, value); },
    } as unknown as AsyncStorageStatic;
    const adapter = new AsyncOfflineQueueStorage(asyncStorage, "test.queue");
    await adapter.write("persisted");
    expect(await adapter.read()).toBe("persisted");
    await adapter.clear();
    expect(await adapter.read()).toBeNull();
  });
});

describe("OfflineMutationQueue", () => {
  it("keeps UUID idempotency, entity version, device time, and FIFO order per shipment", async () => {
    let id = 0;
    let now = new Date("2026-08-21T12:00:00.000Z");
    const storage = new MemoryOfflineQueueStorage();
    const queue = new OfflineMutationQueue({
      clock: () => now,
      idempotencyKeyFactory: () => `uuid-${id += 1}`,
      random: () => 0,
      storage,
    });
    await queue.enqueue(draft("shipment-a"));
    now = new Date("2026-08-21T12:00:01.000Z");
    await queue.enqueue(draft("shipment-a"));
    await queue.enqueue(draft("shipment-b"));

    const processed: string[] = [];
    const onRetryScheduled = jest.fn();
    const report = await queue.flush(async (mutation) => {
      processed.push(mutation.idempotencyKey);
      if (mutation.idempotencyKey === "uuid-1") {
        throw new NetworkRequestError({
          attempts: 2,
          code: "NETWORK_UNAVAILABLE",
          message: "Offline",
          requestId: "request",
          retryable: true,
          status: null,
        });
      }
    }, { onRetryScheduled });

    expect(processed).toEqual(["uuid-1", "uuid-3"]);
    expect(report).toEqual({ failed: 1, pending: 2, processed: 1 });
    const pending = await queue.list();
    expect(pending[0]).toMatchObject({
      attempts: 1,
      deviceCreatedAt: "2026-08-21T12:00:00.000Z",
      entityVersion: 4,
      idempotencyKey: "uuid-1",
    });
    expect(onRetryScheduled).toHaveBeenCalledWith(expect.objectContaining({ shipmentId: "shipment-a" }));

    await queue.retryNow("uuid-1");
    await queue.flush(async (mutation) => { processed.push(mutation.idempotencyKey); });
    expect(processed.slice(-2)).toEqual(["uuid-1", "uuid-2"]);
    expect(await queue.list()).toEqual([]);
    expect(deserializeOfflineQueue(await storage.read() ?? JSON.stringify({ items: [], version: 1 }))).toEqual([]);
    expect(() => deserializeOfflineQueue("not-json")).toThrow("invalid");
  });

  it("retains shared pending files through retries and purges account data on logout", async () => {
    let id = 0;
    const retain = jest.fn(async () => undefined);
    const release = jest.fn(async () => undefined);
    const fileRetention: PendingFileRetention = { release, retain };
    const queue = new OfflineMutationQueue({
      clock: () => new Date("2026-08-21T12:00:00.000Z"),
      fileRetention,
      idempotencyKeyFactory: () => `uuid-${id += 1}`,
    });
    await queue.enqueue(draft("shipment-a", "user-1", ["file://photo.jpg"]));
    await queue.enqueue(draft("shipment-a", "user-1", ["file://photo.jpg"]));
    await queue.flush(async (mutation) => {
      if (mutation.idempotencyKey === "uuid-2") {
        throw new Error("temporary");
      }
    });
    expect(release).not.toHaveBeenCalledWith("file://photo.jpg", "synced");
    await queue.enqueue(draft("shipment-b", "user-2", ["file://other.jpg"]));
    await queue.purgeForLogout("user-1");
    expect(release).toHaveBeenCalledWith("file://photo.jpg", "logout");
    expect((await queue.list()).map((item) => item.ownerUserId)).toEqual(["user-2"]);
    await queue.purgeForLogout(null);
    expect(await queue.list()).toEqual([]);
    expect(retain).toHaveBeenCalledTimes(3);
  });
});
