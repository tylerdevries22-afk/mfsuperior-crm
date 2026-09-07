import type { AccessState, AppRole } from "../../domain/types";
import type { AuthCallbackKind } from "./callback";
import type { MfaState } from "./mfa";

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
