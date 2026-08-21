export type NetworkErrorCode =
  | "ABORTED"
  | "CONFIGURATION"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_UNAVAILABLE"
  | "REQUEST_TIMEOUT";

export interface NetworkFailure {
  readonly code: NetworkErrorCode;
  readonly message: string;
  readonly requestId: string | null;
  readonly status: number | null;
  readonly attempts: number;
  readonly retryable: boolean;
}

export class NetworkRequestError extends Error {
  readonly failure: NetworkFailure;

  constructor(failure: NetworkFailure) {
    super(failure.message);
    this.name = "NetworkRequestError";
    this.failure = failure;
  }

  toJSON(): NetworkFailure {
    return this.failure;
  }
}

export function toNetworkFailure(error: unknown): NetworkFailure {
  if (error instanceof NetworkRequestError) {
    return error.failure;
  }

  return {
    code: "NETWORK_UNAVAILABLE",
    message: "The service could not be reached. Please try again.",
    requestId: null,
    status: null,
    attempts: 0,
    retryable: true,
  };
}
