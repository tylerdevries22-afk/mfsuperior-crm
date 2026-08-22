import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { AccessState, AppRole } from "../../domain/types";
import { exchangeAuthCallback, type AuthCallbackKind } from "./callback";
import { AuthRuntimeError } from "./errors";
import type {
  MembershipSnapshot,
  MembershipSyncGateway,
  MembershipSyncInput,
} from "./membership";
import { loadMfaState, type MfaState } from "./mfa";

/**
 * The runtime identity is derived from `/api/auth/sync`, never from Supabase
 * user or app metadata, so the client cannot widen its own authorization.
 */
export interface AuthIdentity {
  readonly accessState: AccessState;
  readonly carrierId: string | null;
  readonly customerAccountId: string | null;
  readonly driverId: string | null;
  readonly email: string;
  readonly mfa: MfaState;
  readonly organizationId: string;
  readonly organizationSlug: string;
  readonly role: AppRole;
  readonly userId: string;
}

export interface AuthEnrollmentResult {
  readonly emailConfirmationRequired: boolean;
  readonly userId: string;
}

export interface AuthCallbackResult {
  readonly identity: AuthIdentity;
  readonly kind: AuthCallbackKind;
}

export interface MfaChallenge {
  readonly challengeId: string;
  readonly expiresAt: number;
}

export interface TotpEnrollment {
  readonly factorId: string;
  readonly qrCode: string;
  readonly secret: string;
}

export interface LogoutQueuePurger {
  purgeForLogout(userId: string | null): Promise<void>;
}

export class SupabaseAuthService {
  /** Offline queue ownership keys on the server user id, so logout must too. */
  private lastServerUserId: string | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly queuePurger: LogoutQueuePurger | null = null,
    private readonly membershipSync: MembershipSyncGateway | null = null,
  ) {}

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const credentials = validateCredentials(email, password);
    const { data, error } = await this.client.auth.signInWithPassword(credentials);
    if (error || !data.session) {
      throw invalidCredentialsError();
    }
    return this.identityFromSession(data.session);
  }

  /** Redeems an organization invitation, then returns the server identity. */
  async redeemInvitation(invitationToken: string): Promise<AuthIdentity> {
    return this.requireCurrentIdentity({ invitationToken });
  }

  /** Requests pending customer access for the signed-in verified account. */
  async requestCustomerAccess(customerCompanyName?: string): Promise<AuthIdentity> {
    const normalized = customerCompanyName?.trim();
    return this.requireCurrentIdentity(normalized ? { customerCompanyName: normalized } : {});
  }

  async signUp(email: string, password: string): Promise<AuthEnrollmentResult> {
    const credentials = validateCredentials(email, password);
    const { data, error } = await this.client.auth.signUp(credentials);
    if (error || !data.user) {
      throw providerError("Your account could not be created. Please try again.");
    }
    return {
      emailConfirmationRequired: data.session === null,
      userId: data.user.id,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const redirectTo = "mfsuperior://auth/callback?type=recovery";
    const { error } = await this.client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) {
      throw providerError("A password reset email could not be sent. Please try again.");
    }
  }

  async handleCallback(callbackUrl: string): Promise<AuthCallbackResult> {
    const exchanged = await exchangeAuthCallback(this.client, callbackUrl);
    return {
      identity: await this.identityFromSession(exchanged.session),
      kind: exchanged.kind,
    };
  }

  async completePasswordRecovery(password: string): Promise<void> {
    validatePassword(password);
    const { error } = await this.client.auth.updateUser({ password });
    if (error) {
      throw providerError("Your password could not be updated. Please try again.");
    }
  }

  async getCurrentIdentity(): Promise<AuthIdentity | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw providerError("Your session could not be restored. Please sign in again.");
    }
    return data.session ? this.identityFromSession(data.session) : null;
  }

  private async requireCurrentIdentity(input: MembershipSyncInput): Promise<AuthIdentity> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) {
      throw providerError("Your session could not be restored. Please sign in again.");
    }
    return this.identityFromSession(data.session, input);
  }

  async getAccessToken(): Promise<string | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw providerError("Your session could not be restored. Please sign in again.");
    }
    return data.session?.access_token ?? null;
  }

  async getMfaState(): Promise<MfaState> {
    return loadMfaState(this.client);
  }

  async challengeMfa(factorId: string): Promise<MfaChallenge> {
    const { data, error } = await this.client.auth.mfa.challenge({
      factorId: requireNonEmpty(factorId, "MFA factor"),
    });
    if (error) {
      throw providerError("A multi-factor challenge could not be started.");
    }
    return { challengeId: data.id, expiresAt: data.expires_at };
  }

  async enrollTotp(friendlyName?: string): Promise<TotpEnrollment> {
    const normalizedName = friendlyName?.trim();
    const { data, error } = await this.client.auth.mfa.enroll({
      factorType: "totp",
      ...(normalizedName ? { friendlyName: normalizedName } : {}),
    });
    if (error) {
      throw providerError("An authenticator could not be enrolled. Please try again.");
    }
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  }

  async verifyMfa(factorId: string, challengeId: string, code: string): Promise<AuthIdentity> {
    const { data, error } = await this.client.auth.mfa.verify({
      challengeId: requireNonEmpty(challengeId, "MFA challenge"),
      code: validateMfaCode(code),
      factorId: requireNonEmpty(factorId, "MFA factor"),
    });
    if (error || !data) {
      throw new AuthRuntimeError({
        code: "MFA_REQUIRED",
        message: "The verification code is incorrect or expired.",
        retryable: false,
      });
    }
    const identity = await this.getCurrentIdentity();
    if (!identity) {
      throw providerError("Your verified session could not be loaded.");
    }
    return identity;
  }

  async signOut(): Promise<void> {
    const currentUserId = this.lastServerUserId;
    const { error } = await this.client.auth.signOut();
    this.lastServerUserId = null;
    await this.queuePurger?.purgeForLogout(currentUserId);
    if (error) {
      throw providerError("Sign out could not be completed. Please try again.");
    }
  }

  private async identityFromSession(
    session: Session,
    syncInput: MembershipSyncInput = {},
  ): Promise<AuthIdentity> {
    const email = session.user.email?.trim().toLowerCase();
    if (!email) {
      throw unassignedIdentityError();
    }
    if (!this.membershipSync) {
      throw new AuthRuntimeError({
        code: "AUTH_PROVIDER_FAILED",
        message: "Workspace membership verification is not configured.",
        retryable: false,
      });
    }
    const membership = await this.membershipSync.sync(syncInput);
    this.lastServerUserId = membership.userId;
    return toAuthIdentity(membership, email, await loadMfaState(this.client));
  }
}

function toAuthIdentity(
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

function unassignedIdentityError(): AuthRuntimeError {
  return new AuthRuntimeError({
    code: "ROLE_UNAUTHORIZED",
    message: "This account is not assigned to an MF Superior Products role.",
    retryable: false,
  });
}

function validateCredentials(email: string, password: string): { email: string; password: string } {
  return { email: normalizeEmail(email), password: validatePassword(password) };
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    throw invalidCredentialsError();
  }
  return normalized;
}

function validatePassword(password: string): string {
  if (password.length < 12 || password.length > 128) {
    throw new AuthRuntimeError({
      code: "PASSWORD_INVALID",
      message: "Use a password between 12 and 128 characters.",
      retryable: false,
    });
  }
  return password;
}

function validateMfaCode(code: string): string {
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

function requireNonEmpty(value: string, label: string): string {
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

function invalidCredentialsError(): AuthRuntimeError {
  return new AuthRuntimeError({
    code: "INVALID_CREDENTIALS",
    message: "The email or password is incorrect.",
    retryable: false,
  });
}

function providerError(message: string): AuthRuntimeError {
  return new AuthRuntimeError({ code: "AUTH_PROVIDER_FAILED", message, retryable: true });
}
