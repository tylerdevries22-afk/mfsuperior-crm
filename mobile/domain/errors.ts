export type OperationsErrorCode =
  | "AUTHENTICATION_FAILED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "INVALID_TRANSITION"
  | "HOS_LIMIT_REACHED"
  | "BREAK_REQUIRED"
  | "PERSISTENCE_READ_FAILED"
  | "PERSISTENCE_WRITE_FAILED"
  | "CORRUPT_PERSISTED_STATE";

export interface OperationsFailure {
  readonly code: OperationsErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export class OperationsDomainError extends Error {
  readonly code: OperationsErrorCode;
  readonly safeMessage: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: OperationsErrorCode,
    safeMessage: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    super(safeMessage);
    this.name = "OperationsDomainError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details;
  }
}

export function toOperationsFailure(error: unknown): OperationsFailure {
  if (error instanceof OperationsDomainError) {
    return {
      code: error.code,
      message: error.safeMessage,
      details: error.details,
    };
  }

  return {
    code: "VALIDATION_FAILED",
    message: "The requested operation could not be completed.",
  };
}
