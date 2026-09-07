import { OperationsDomainError } from "../../domain/errors";
import { NetworkRequestError } from "../../lib/network";

export function encodeId(value: string): string {
  return encodeURIComponent(value);
}

export function productionOnlyError(message: string): OperationsDomainError {
  return new OperationsDomainError("UNAUTHORIZED", message);
}

export function toDomainNetworkError(error: unknown): OperationsDomainError {
  if (error instanceof OperationsDomainError) {
    return error;
  }
  if (error instanceof NetworkRequestError && error.failure.status === 409) {
    return new OperationsDomainError("CONFLICT", error.failure.message);
  }
  if (error instanceof NetworkRequestError) {
    return new OperationsDomainError("NETWORK_FAILED", error.failure.message, {
      requestId: error.failure.requestId,
      status: error.failure.status,
    });
  }
  return new OperationsDomainError("NETWORK_FAILED", "Freight operations could not be reached.");
}
