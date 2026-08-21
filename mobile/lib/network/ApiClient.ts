import { randomUUID } from "expo-crypto";

import { NetworkRequestError, type NetworkFailure } from "./errors";
import {
  createResilientFetch,
  NETWORK_MAX_ATTEMPTS,
  NETWORK_TIMEOUT_MS,
  type ResilientFetchOptions,
} from "./retry";

export type ApiHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface ApiRequestOptions {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotencyKey?: string;
  readonly method?: ApiHttpMethod;
  readonly signal?: AbortSignal;
}

export interface NetworkLogContext {
  readonly attempts: number;
  readonly code: NetworkFailure["code"];
  readonly method: ApiHttpMethod;
  readonly path: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly status: number | null;
}

export interface NetworkLogger {
  error(event: "api_request_failed", context: NetworkLogContext): void;
}

export interface ApiClientOptions extends ResilientFetchOptions {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly logger?: NetworkLogger;
  readonly requestIdFactory?: () => string;
}

export class ApiClient {
  private readonly baseUrl: URL;
  private readonly fetchImplementation: typeof fetch;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly logger: NetworkLogger | null;
  private readonly requestIdFactory: () => string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.getAccessToken = options.getAccessToken;
    this.logger = options.logger ?? null;
    this.requestIdFactory = options.requestIdFactory ?? randomUUID;
    this.fetchImplementation = createResilientFetch({
      fetchImplementation: options.fetchImplementation,
      random: options.random,
      sleep: options.sleep,
      timeoutMs: options.timeoutMs ?? NETWORK_TIMEOUT_MS,
    });
  }

  async requestJson<Result>(path: string, options: ApiRequestOptions = {}): Promise<Result> {
    const method = options.method ?? "GET";
    requireIdempotencyForMutation(method, options.idempotencyKey);
    const requestId = this.requestIdFactory();
    const response = await this.performRequest(path, method, requestId, options);
    if (!response.ok) {
      throw this.httpError(path, method, requestId, response.status);
    }
    return parseJsonResponse<Result>(response, requestId);
  }

  private async performRequest(
    path: string,
    method: ApiHttpMethod,
    requestId: string,
    options: ApiRequestOptions,
  ): Promise<Response> {
    try {
      const accessToken = await this.getAccessToken();
      return await this.fetchImplementation(buildApiUrl(this.baseUrl, path), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers: buildHeaders(requestId, accessToken, options),
        method,
        signal: options.signal,
      });
    } catch (error: unknown) {
      if (error instanceof NetworkRequestError) {
        throw error;
      }
      const failure = classifyTransportFailure(error, requestId);
      this.logFailure(path, method, failure);
      throw new NetworkRequestError(failure);
    }
  }

  private httpError(
    path: string,
    method: ApiHttpMethod,
    requestId: string,
    status: number,
  ): NetworkRequestError {
    const failure: NetworkFailure = {
      code: "HTTP_ERROR",
      message: safeHttpMessage(status),
      requestId,
      status,
      attempts: isRetryableHttpStatus(status) ? NETWORK_MAX_ATTEMPTS : 1,
      retryable: isRetryableHttpStatus(status),
    };
    this.logFailure(path, method, failure);
    return new NetworkRequestError(failure);
  }

  private logFailure(path: string, method: ApiHttpMethod, failure: NetworkFailure): void {
    this.logger?.error("api_request_failed", {
      attempts: failure.attempts,
      code: failure.code,
      method,
      path: safeLogPath(path),
      requestId: failure.requestId ?? "unknown",
      retryable: failure.retryable,
      status: failure.status,
    });
  }
}

function validateBaseUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error("Unsupported API protocol.");
    }
    return url;
  } catch {
    throw new NetworkRequestError({
      code: "CONFIGURATION",
      message: "The operations service is not configured.",
      requestId: null,
      status: null,
      attempts: 0,
      retryable: false,
    });
  }
}

function buildApiUrl(baseUrl: URL, path: string): URL {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path) || path.startsWith("//") || path.split("/").includes("..")) {
    throw invalidPathError();
  }
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, ensureTrailingSlash(baseUrl));
}

function invalidPathError(): NetworkRequestError {
  return new NetworkRequestError({
    code: "CONFIGURATION",
    message: "The API request path is invalid.",
    requestId: null,
    status: null,
    attempts: 0,
    retryable: false,
  });
}

function ensureTrailingSlash(url: URL): URL {
  const copy = new URL(url.toString());
  copy.pathname = copy.pathname.endsWith("/") ? copy.pathname : `${copy.pathname}/`;
  return copy;
}

function buildHeaders(
  requestId: string,
  accessToken: string | null,
  options: ApiRequestOptions,
): Record<string, string> {
  return {
    Accept: "application/json",
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    ...options.headers,
    "X-Request-ID": requestId,
  };
}

function requireIdempotencyForMutation(method: ApiHttpMethod, key: string | undefined): void {
  if (method !== "GET" && !key?.trim()) {
    throw new NetworkRequestError({
      code: "CONFIGURATION",
      message: "A safe retry key is required for this operation.",
      requestId: null,
      status: null,
      attempts: 0,
      retryable: false,
    });
  }
}

function classifyTransportFailure(error: unknown, requestId: string): NetworkFailure {
  const aborted = error instanceof Error && error.name === "AbortError";
  return {
    code: aborted ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE",
    message: aborted
      ? "The request timed out. Please try again."
      : "The service could not be reached. Please try again.",
    requestId,
    status: null,
    attempts: NETWORK_MAX_ATTEMPTS,
    retryable: true,
  };
}

async function parseJsonResponse<Result>(response: Response, requestId: string): Promise<Result> {
  try {
    const payload = await response.json() as unknown;
    return unwrapApiEnvelope<Result>(payload, requestId);
  } catch {
    throw new NetworkRequestError({
      code: "INVALID_RESPONSE",
      message: "The service returned an invalid response.",
      requestId,
      status: response.status,
      attempts: 1,
      retryable: false,
    });
  }
}

function unwrapApiEnvelope<Result>(payload: unknown, requestId: string): Result {
  if (!isRecord(payload) || !("data" in payload) || !("error" in payload) || !("meta" in payload)) {
    return payload as Result;
  }
  if (payload.error !== null || payload.data === null) {
    throw new NetworkRequestError({
      attempts: 1,
      code: "INVALID_RESPONSE",
      message: "The service returned an invalid response.",
      requestId,
      retryable: false,
      status: null,
    });
  }
  return payload.data as Result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeHttpMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Your session is not authorized for this operation.";
  }
  if (status === 404) {
    return "The requested operations record was not found.";
  }
  if (status === 409) {
    return "This record changed on another device. Refresh and try again.";
  }
  if (status === 422) {
    return "The operation contains invalid information.";
  }
  return "The operations service could not complete the request.";
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function safeLogPath(path: string): string {
  return path.split("?")[0] ?? "/";
}
