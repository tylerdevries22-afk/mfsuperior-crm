import type { NetworkFailure } from "./errors";
import type { ResilientFetchOptions } from "./retry";

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
