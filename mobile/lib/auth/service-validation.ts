import { AuthRuntimeError } from "./errors";
import { invalidCredentialsError } from "./service-errors";
import type { MembershipSnapshot } from "./membership";
import type { MfaState } from "./mfa";
import type { AuthIdentity } from "./service-types";

export function toAuthIdentity(
  membership: MembershipSnapshot,
  email: string,
  mfa: MfaState,
): AuthIdentity {
  return {
    accessState: membership.accessState,
    carrierId: membership.carrierId,
    customerAccountId: membership.customerAccountId,
    driverId: membership.driverId,
    email,
    mfa,
    organizationId: membership.organizationId,
    organizationSlug: membership.organizationSlug,
    role: membership.role,
    userId: membership.userId,
  };
}

export function validateCredentials(email: string, password: string): { email: string; password: string } {
  return { email: normalizeEmail(email), password: validatePassword(password) };
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    throw invalidCredentialsError();
  }
  return normalized;
}

export function validatePassword(password: string): string {
  if (password.length < 12 || password.length > 128) {
    throw new AuthRuntimeError({
      code: "PASSWORD_INVALID",
      message: "Use a password between 12 and 128 characters.",
      retryable: false,
    });
  }
  return password;
}

export function validateMfaCode(code: string): string {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new AuthRuntimeError({
      code: "MFA_REQUIRED",
      message: "Enter the six-digit verification code.",
      retryable: false,
    });
  }
  return normalized;
}

export function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuthRuntimeError({
      code: "MFA_REQUIRED",
      message: `${label} is required.`,
      retryable: false,
    });
  }
  return normalized;
}
