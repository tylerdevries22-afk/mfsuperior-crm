import { AuthRuntimeError } from "./errors";

export function invalidCredentialsError(): AuthRuntimeError {
  return new AuthRuntimeError({
    code: "INVALID_CREDENTIALS",
    message: "The email or password is incorrect.",
    retryable: false,
  });
}

export function providerError(message: string): AuthRuntimeError {
  return new AuthRuntimeError({ code: "AUTH_PROVIDER_FAILED", message, retryable: true });
}

export function unassignedIdentityError(): AuthRuntimeError {
  return new AuthRuntimeError({
    code: "ROLE_UNAUTHORIZED",
    message: "This account is not assigned to an MF Superior Products role.",
    retryable: false,
  });
}
