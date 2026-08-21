import type { Factor, SupabaseClient } from "@supabase/supabase-js";

import { AuthRuntimeError } from "./errors";

export type MfaAssuranceLevel = "aal1" | "aal2";
export type MfaStatus = "challenge_required" | "unenrolled" | "verified";

export interface MfaFactor {
  readonly factorType: "phone" | "totp" | "webauthn";
  readonly friendlyName: string | null;
  readonly id: string;
  readonly status: "unverified" | "verified";
}

export interface MfaState {
  readonly currentLevel: MfaAssuranceLevel;
  readonly factors: readonly MfaFactor[];
  readonly nextLevel: MfaAssuranceLevel;
  readonly status: MfaStatus;
}

export interface MfaStateInput {
  readonly currentLevel: string | null;
  readonly factors: readonly MfaFactor[];
  readonly nextLevel: string | null;
}

export function deriveMfaState(input: MfaStateInput): MfaState {
  const currentLevel = normalizeAssuranceLevel(input.currentLevel);
  const nextLevel = normalizeAssuranceLevel(input.nextLevel);
  const hasVerifiedFactor = input.factors.some((factor) => factor.status === "verified");
  const status = currentLevel === "aal2"
    ? "verified"
    : nextLevel === "aal2" && hasVerifiedFactor
      ? "challenge_required"
      : "unenrolled";
  return { currentLevel, factors: input.factors, nextLevel, status };
}

export async function loadMfaState(client: SupabaseClient): Promise<MfaState> {
  const [factorResult, assuranceResult] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorResult.error || assuranceResult.error) {
    throw new AuthRuntimeError({
      code: "AUTH_PROVIDER_FAILED",
      message: "Multi-factor authentication status could not be loaded.",
      retryable: true,
    });
  }
  return deriveMfaState({
    currentLevel: assuranceResult.data.currentLevel,
    factors: factorResult.data.all.map(mapFactor),
    nextLevel: assuranceResult.data.nextLevel,
  });
}

function mapFactor(factor: Factor): MfaFactor {
  return {
    factorType: factor.factor_type,
    friendlyName: factor.friendly_name ?? null,
    id: factor.id,
    status: factor.status,
  };
}

function normalizeAssuranceLevel(level: string | null): MfaAssuranceLevel {
  return level === "aal2" ? "aal2" : "aal1";
}
