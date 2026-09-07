import type { NetworkFailure } from "./errors";
import { NETWORK_MAX_ATTEMPTS } from "./retry";

export function classifyTransportFailure(error: unknown, requestId: string): NetworkFailure {
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

export function safeHttpMessage(status: number): string {
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

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
