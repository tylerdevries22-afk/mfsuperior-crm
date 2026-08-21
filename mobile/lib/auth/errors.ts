export type AuthErrorCode =
  | "AUTH_CONFIGURATION_INVALID"
  | "AUTH_PROVIDER_FAILED"
  | "CALLBACK_INVALID"
  | "EMAIL_CONFIRMATION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "MFA_REQUIRED"
  | "PASSWORD_INVALID"
  | "ROLE_UNAUTHORIZED";

export interface AuthFailure {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export class AuthRuntimeError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure) {
    super(failure.message);
    this.name = "AuthRuntimeError";
    this.failure = failure;
  }

  toJSON(): AuthFailure {
    return this.failure;
  }
}

export function toAuthFailure(error: unknown): AuthFailure {
  if (error instanceof AuthRuntimeError) {
    return error.failure;
  }

  return {
    code: "AUTH_PROVIDER_FAILED",
    message: "Authentication could not be completed. Please try again.",
    retryable: true,
  };
}
