import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { APP_ROLES, type AppRole } from "../../domain/types";
import { exchangeAuthCallback, type AuthCallbackKind } from "./callback";
import { AuthRuntimeError } from "./errors";
import { loadMfaState, type MfaState } from "./mfa";

export interface AuthIdentity {
  readonly email: string;
  readonly mfa: MfaState;
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
  constructor(
    private readonly client: SupabaseClient,
    private readonly queuePurger: LogoutQueuePurger | null = null,
  ) {}

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const credentials = validateCredentials(email, password);
    const { data, error } = await this.client.auth.signInWithPassword(credentials);
    if (error || !data.session) {
      throw invalidCredentialsError();
    }
    return this.identityFromSession(data.session);
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
    const currentUserId = (await this.client.auth.getSession()).data.session?.user.id ?? null;
    const { error } = await this.client.auth.signOut();
    await this.queuePurger?.purgeForLogout(currentUserId);
    if (error) {
      throw providerError("Sign out could not be completed. Please try again.");
    }
  }

  private async identityFromSession(session: Session): Promise<AuthIdentity> {
    const role = resolveAppRole(session.user);
    const email = session.user.email?.trim();
    if (!role || !email) {
      throw new AuthRuntimeError({
        code: "ROLE_UNAUTHORIZED",
        message: "This account is not assigned to an MF Superior Products role.",
        retryable: false,
      });
    }
    return { email, mfa: await loadMfaState(this.client), role, userId: session.user.id };
  }
}

export function resolveAppRole(user: Pick<User, "app_metadata">): AppRole | null {
  const role = user.app_metadata.role;
  return typeof role === "string" && APP_ROLES.some((candidate) => candidate === role)
    ? role as AppRole
    : null;
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
