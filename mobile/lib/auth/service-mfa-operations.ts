import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthRuntimeError } from "./errors";
import { providerError } from "./service-errors";
import type { MfaChallenge, TotpEnrollment } from "./service-types";
import { requireNonEmpty, validateMfaCode } from "./service-validation";

export async function challengeMfaFactor(
  client: SupabaseClient,
  factorId: string,
): Promise<MfaChallenge> {
  const { data, error } = await client.auth.mfa.challenge({
    factorId: requireNonEmpty(factorId, "MFA factor"),
  });
  if (error) {
    throw providerError("A multi-factor challenge could not be started.");
  }
  return { challengeId: data.id, expiresAt: data.expires_at };
}

export async function enrollTotpFactor(
  client: SupabaseClient,
  friendlyName?: string,
): Promise<TotpEnrollment> {
  const normalizedName = friendlyName?.trim();
  const { data, error } = await client.auth.mfa.enroll({
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

/** Verifies the challenge only; the caller reloads the server identity after. */
export async function verifyMfaFactor(
  client: SupabaseClient,
  factorId: string,
  challengeId: string,
  code: string,
): Promise<void> {
  const { data, error } = await client.auth.mfa.verify({
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
}
