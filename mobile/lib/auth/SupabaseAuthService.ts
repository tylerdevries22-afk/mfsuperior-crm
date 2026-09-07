import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { exchangeAuthCallback } from "./callback";
import { AuthRuntimeError } from "./errors";
import type { MembershipSyncGateway, MembershipSyncInput } from "./membership";
import { loadMfaState, type MfaState } from "./mfa";
import {
  invalidCredentialsError,
  providerError,
  unassignedIdentityError,
} from "./service-errors";
import {
  challengeMfaFactor,
  enrollTotpFactor,
  verifyMfaFactor,
} from "./service-mfa-operations";
import type {
  AuthCallbackResult,
  AuthEnrollmentResult,
  AuthIdentity,
  LogoutQueuePurger,
  MfaChallenge,
  TotpEnrollment,
} from "./service-types";
import {
  normalizeEmail,
  toAuthIdentity,
  validateCredentials,
  validatePassword,
} from "./service-validation";

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

  /** Shares the authenticated client with realtime and push registration layers. */
  getClient(): SupabaseClient {
    return this.client;
  }

  async getMfaState(): Promise<MfaState> {
    return loadMfaState(this.client);
  }

  async challengeMfa(factorId: string): Promise<MfaChallenge> {
    return challengeMfaFactor(this.client, factorId);
  }

  async enrollTotp(friendlyName?: string): Promise<TotpEnrollment> {
    return enrollTotpFactor(this.client, friendlyName);
  }

  async verifyMfa(factorId: string, challengeId: string, code: string): Promise<AuthIdentity> {
    await verifyMfaFactor(this.client, factorId, challengeId, code);
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
