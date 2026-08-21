import { describe, expect, it, jest } from "@jest/globals";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { exchangeAuthCallback, parseAuthCallbackUrl } from "../callback";
import { AuthRuntimeError } from "../errors";
import { deriveMfaState, loadMfaState } from "../mfa";

const SESSION = { access_token: "access-token" } as Session;

describe("PKCE callback helpers", () => {
  it("parses sign-in and recovery parameters without returning provider errors", () => {
    expect(parseAuthCallbackUrl("mfsuperior://auth/callback?code=abc&sb_flow_id=flow")).toEqual({
      code: "abc",
      flowId: "flow",
      kind: "sign-in",
    });
    expect(parseAuthCallbackUrl("mfsuperior://auth/callback#code=xyz&type=recovery")).toEqual({
      code: "xyz",
      flowId: null,
      kind: "password-recovery",
    });
    expect(() => parseAuthCallbackUrl("mfsuperior://auth/callback?error=denied")).toThrow(
      AuthRuntimeError,
    );
  });

  it("exchanges a one-time PKCE code with its flow identifier", async () => {
    const exchangeCodeForSession = jest.fn(async () => ({
      data: { session: SESSION, user: null },
      error: null,
    }));
    const client = { auth: { exchangeCodeForSession } } as unknown as SupabaseClient;
    const result = await exchangeAuthCallback(
      client,
      "mfsuperior://auth/callback?code=abc&sb_flow_id=flow&type=recovery",
    );
    expect(result.kind).toBe("password-recovery");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flow" });
  });
});

describe("MFA state", () => {
  it("models unenrolled, challenge-required, and verified sessions", () => {
    expect(deriveMfaState({ currentLevel: "aal1", factors: [], nextLevel: "aal1" }).status).toBe(
      "unenrolled",
    );
    const factors = [{
      factorType: "totp" as const,
      friendlyName: "Authenticator",
      id: "factor-1",
      status: "verified" as const,
    }];
    expect(deriveMfaState({ currentLevel: "aal1", factors, nextLevel: "aal2" }).status).toBe(
      "challenge_required",
    );
    expect(deriveMfaState({ currentLevel: "aal2", factors, nextLevel: "aal2" }).status).toBe(
      "verified",
    );
  });

  it("loads factors and assurance levels from Supabase", async () => {
    const client = {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: { currentAuthenticationMethods: [], currentLevel: "aal1", nextLevel: "aal2" },
            error: null,
          }),
          listFactors: async () => ({
            data: {
              all: [{
                created_at: "2026-08-21T00:00:00.000Z",
                factor_type: "totp",
                id: "factor-1",
                status: "verified",
                updated_at: "2026-08-21T00:00:00.000Z",
              }],
              phone: [],
              totp: [],
              webauthn: [],
            },
            error: null,
          }),
        },
      },
    } as unknown as SupabaseClient;
    expect((await loadMfaState(client)).status).toBe("challenge_required");
  });
});
