import { randomUUID } from "expo-crypto";

import { classifyTransportFailure, isRetryableHttpStatus, safeHttpMessage } from "./api-failures";
import { buildHeaders, requireIdempotencyForMutation } from "./api-headers";
import type {
  ApiClientOptions,
  ApiHttpMethod,
  ApiRequestOptions,
  NetworkLogger,
} from "./api-request-types";
import { parseJsonResponse } from "./api-response";
import { buildApiUrl, safeLogPath, validateBaseUrl } from "./api-url";
import { NetworkRequestError, type NetworkFailure } from "./errors";
import { createResilientFetch, NETWORK_MAX_ATTEMPTS, NETWORK_TIMEOUT_MS } from "./retry";

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
