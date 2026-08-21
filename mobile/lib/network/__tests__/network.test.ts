import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { ApiClient, type NetworkLogger } from "../ApiClient";
import { NetworkRequestError, toNetworkFailure } from "../errors";
import { computeRetryDelayMs, createResilientFetch } from "../retry";

function response(status: number, body: unknown = {}): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

afterEach(() => {
  jest.useRealTimers();
});

describe("network retry policy", () => {
  it("uses bounded exponential jitter and exactly two attempts", async () => {
    expect(computeRetryDelayMs(1, 0)).toBe(250);
    expect(computeRetryDelayMs(2, 1)).toBe(750);
    const fetchImplementation = jest.fn(async () => response(503));
    const resilientFetch = createResilientFetch({
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
      random: () => 0,
      sleep: async () => undefined,
    });
    expect((await resilientFetch("https://api.example.com")).status).toBe(503);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("times out each network attempt", async () => {
    jest.useFakeTimers();
    const fetchImplementation = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    ));
    const resilientFetch = createResilientFetch({
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
      sleep: async () => undefined,
      timeoutMs: 10,
    });
    const pending = resilientFetch("https://api.example.com");
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await jest.advanceTimersByTimeAsync(25);
    await rejection;
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});

describe("ApiClient", () => {
  it("adds request and idempotency IDs while keeping logs redacted", async () => {
    const requests: { readonly init?: RequestInit; readonly input: RequestInfo | URL }[] = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push({ init, input });
      return response(200, { ok: true });
    };
    const error = jest.fn();
    const logger: NetworkLogger = { error };
    const client = new ApiClient({
      baseUrl: "https://api.example.com/mobile",
      fetchImplementation,
      getAccessToken: async () => "private-access-token",
      logger,
      requestIdFactory: () => "request-1",
      sleep: async () => undefined,
    });
    await expect(client.requestJson("shipments", {
      body: { secret: "never-log" },
      idempotencyKey: "mutation-1",
      method: "POST",
    })).resolves.toEqual({ ok: true });
    const call = requests[0];
    const init = call?.init;
    expect(call?.input.toString()).toBe("https://api.example.com/mobile/shipments");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer private-access-token",
      "Idempotency-Key": "mutation-1",
      "X-Request-ID": "request-1",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("unwraps structured mobile API envelopes while preserving legacy JSON responses", async () => {
    const responses = [
      response(200, { data: { id: "shipment-1" }, error: null, meta: { requestId: "server-1" } }),
      response(200, { id: "legacy-1" }),
    ];
    const client = new ApiClient({
      baseUrl: "https://api.example.com/api/mobile",
      fetchImplementation: jest.fn(async () => responses.shift() ?? response(500)) as unknown as typeof fetch,
      getAccessToken: async () => "access-token",
      requestIdFactory: () => "request-envelope",
      sleep: async () => undefined,
    });

    await expect(client.requestJson("v1/shipments")).resolves.toEqual({ id: "shipment-1" });
    await expect(client.requestJson("legacy")).resolves.toEqual({ id: "legacy-1" });
  });

  it("requires retry-safe mutation keys and emits structured errors without response bodies", async () => {
    const log = jest.fn();
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      fetchImplementation: jest.fn(async () => response(403, { token: "secret" })) as unknown as typeof fetch,
      getAccessToken: async () => null,
      logger: { error: log },
      requestIdFactory: () => "request-2",
      sleep: async () => undefined,
    });
    await expect(client.requestJson("shipments", { body: {}, method: "POST" })).rejects.toMatchObject({
      failure: { code: "CONFIGURATION" },
    });
    await expect(client.requestJson("shipments?token=secret")).rejects.toMatchObject({
      failure: { code: "HTTP_ERROR", requestId: "request-2", status: 403 },
    });
    expect(log).toHaveBeenCalledWith("api_request_failed", expect.objectContaining({
      path: "shipments",
      requestId: "request-2",
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    expect(toNetworkFailure(new Error("private"))).toEqual({
      attempts: 0,
      code: "NETWORK_UNAVAILABLE",
      message: "The service could not be reached. Please try again.",
      requestId: null,
      retryable: true,
      status: null,
    });
    expect(new NetworkRequestError(toNetworkFailure(new Error())).toJSON().code).toBe(
      "NETWORK_UNAVAILABLE",
    );
  });
});
