import { NetworkRequestError } from "./errors";
import type { ApiHttpMethod, ApiRequestOptions } from "./api-request-types";

export function buildHeaders(
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

export function requireIdempotencyForMutation(method: ApiHttpMethod, key: string | undefined): void {
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
