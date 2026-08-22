import { describe, expect, it, jest } from "@jest/globals";
import type { AppStateStatus } from "react-native";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseAuthClient, registerAuthAutoRefresh } from "../client";
import { AuthRuntimeError, toAuthFailure } from "../errors";
import {
  parseMembershipSnapshot,
  type MembershipSnapshot,
  type MembershipSyncGateway,
  type MembershipSyncInput,
} from "../membership";
import type { AuthSessionStorage } from "../secureStore";
import { SupabaseAuthService } from "../service";

const USER = {
  app_metadata: { role: "admin" },
  email: "admin@example.com",
  id: "user-admin",
  user_metadata: { role: "customer" },
} as unknown as User;

const ADMIN_MEMBERSHIP: MembershipSnapshot = {
  accessState: "active",
  carrierId: "carrier-1",
  customerAccountId: null,
  driverId: null,
  membershipStatus: "active",
  organizationId: "organization-1",
  organizationSlug: "mf-superior",
  role: "admin",
  userId: "user-admin",
};

function createMembershipSync(
  snapshot: MembershipSnapshot = ADMIN_MEMBERSHIP,
): MembershipSyncGateway & { calls: MembershipSyncInput[] } {
  const calls: MembershipSyncInput[] = [];
  return {
    calls,
    sync: async (input: MembershipSyncInput = {}) => {
      calls.push(input);
      return snapshot;
    },
  };
}

const SESSION = {
  access_token: "access-token",
  user: USER,
} as Session;

function createClientMock(): SupabaseClient {
  return {
    auth: {
      exchangeCodeForSession: jest.fn(async () => ({ data: { session: SESSION, user: USER }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: SESSION }, error: null })),
      mfa: {
        challenge: jest.fn(async () => ({ data: { expires_at: 123, id: "challenge-1" }, error: null })),
        enroll: jest.fn(async () => ({
          data: {
            id: "factor-new",
            totp: { qr_code: "svg-qr", secret: "totp-secret", uri: "otpauth://example" },
            type: "totp",
          },
          error: null,
        })),
        getAuthenticatorAssuranceLevel: jest.fn(async () => ({
          data: { currentAuthenticationMethods: [], currentLevel: "aal2", nextLevel: "aal2" },
          error: null,
        })),
        listFactors: jest.fn(async () => ({
          data: { all: [], phone: [], totp: [], webauthn: [] },
          error: null,
        })),
        verify: jest.fn(async () => ({ data: SESSION, error: null })),
      },
      resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
      signInWithPassword: jest.fn(async () => ({ data: { session: SESSION, user: USER }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      signUp: jest.fn(async () => ({ data: { session: null, user: USER }, error: null })),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      updateUser: jest.fn(async () => ({ data: { user: USER }, error: null })),
    },
  } as unknown as SupabaseClient;
}

describe("SupabaseAuthService", () => {
  it("supports credentials, enrollment, recovery, callback, MFA, session, and logout", async () => {
    const client = createClientMock();
    const purgeForLogout = jest.fn(async () => undefined);
    const membershipSync = createMembershipSync();
    const service = new SupabaseAuthService(client, { purgeForLogout }, membershipSync);

    const identity = await service.signIn(" ADMIN@EXAMPLE.COM ", "correct horse battery staple");
    expect(identity.role).toBe("admin");
    expect(identity.email).toBe("admin@example.com");
    expect(await service.signUp("new@example.com", "correct horse battery staple")).toEqual({
      emailConfirmationRequired: true,
      userId: "user-admin",
    });
    await service.requestPasswordReset("admin@example.com");
    expect((await service.handleCallback("mfsuperior://auth/callback?code=abc")).kind).toBe("sign-in");
    await service.completePasswordRecovery("new correct horse battery staple");
    expect((await service.getCurrentIdentity())?.userId).toBe("user-admin");
    expect(await service.getAccessToken()).toBe("access-token");
    expect((await service.getMfaState()).status).toBe("verified");
    expect(await service.challengeMfa("factor-1")).toEqual({ challengeId: "challenge-1", expiresAt: 123 });
    expect(await service.enrollTotp(" Work phone ")).toEqual({
      factorId: "factor-new",
      qrCode: "svg-qr",
      secret: "totp-secret",
    });
    expect((await service.verifyMfa("factor-1", "challenge-1", "123456")).role).toBe("admin");
    await service.signOut();
    expect(purgeForLogout).toHaveBeenCalledWith("user-admin");
    expect(membershipSync.calls.length).toBeGreaterThan(0);
  });

  it("derives role and access state from the server, never from Supabase metadata", async () => {
    const pendingSync = createMembershipSync({
      accessState: "pending_customer_approval",
      carrierId: null,
      customerAccountId: null,
      driverId: null,
      membershipStatus: "pending",
      organizationId: "organization-1",
      organizationSlug: "mf-superior",
      role: "customer",
      userId: "user-admin",
    });
    // The Supabase user carries app_metadata.role === "admin"; it must be ignored.
    const service = new SupabaseAuthService(createClientMock(), null, pendingSync);
    const identity = await service.signIn("admin@example.com", "correct horse battery staple");
    expect(identity.role).toBe("customer");
    expect(identity.accessState).toBe("pending_customer_approval");

    await service.requestCustomerAccess(" Northline Freight ");
    expect(pendingSync.calls.at(-1)).toEqual({ customerCompanyName: "Northline Freight" });
    await service.redeemInvitation("invitation-token");
    expect(pendingSync.calls.at(-1)).toEqual({ invitationToken: "invitation-token" });
  });

  it("refuses membership payloads that do not agree with themselves", () => {
    expect(() => parseMembershipSnapshot({ ...ADMIN_MEMBERSHIP, role: "operator" })).toThrow(
      AuthRuntimeError,
    );
    expect(() => parseMembershipSnapshot({ ...ADMIN_MEMBERSHIP, membershipStatus: "pending" })).toThrow(
      AuthRuntimeError,
    );
    expect(() => parseMembershipSnapshot({
      ...ADMIN_MEMBERSHIP,
      accessState: "pending_customer_approval",
      membershipStatus: "pending",
    })).toThrow(AuthRuntimeError);
    expect(parseMembershipSnapshot(ADMIN_MEMBERSHIP)).toEqual(ADMIN_MEMBERSHIP);
  });

  it("returns structured safe failures", async () => {
    const service = new SupabaseAuthService(createClientMock(), null, createMembershipSync());
    await expect(service.signIn("invalid", "short")).rejects.toBeInstanceOf(AuthRuntimeError);
    expect(toAuthFailure(new Error("secret provider detail"))).toEqual({
      code: "AUTH_PROVIDER_FAILED",
      message: "Authentication could not be completed. Please try again.",
      retryable: true,
    });
  });
});

describe("Supabase auth client lifecycle", () => {
  it("creates a PKCE client with injected storage and controls foreground refresh", () => {
    const values = new Map<string, string>();
    const storage: AuthSessionStorage = {
      getItem: async (key) => values.get(key) ?? null,
      removeItem: async (key) => { values.delete(key); },
      setItem: async (key, value) => { values.set(key, value); },
    };
    const client = createSupabaseAuthClient({
      apiBaseUrl: "https://api.example.com/api/mobile",
      authApiBaseUrl: "https://api.example.com/api/auth",
      redirectScheme: "mfsuperior",
      supabasePublishableKey: "sb_publishable_test",
      supabaseUrl: "https://project.supabase.co",
    }, { fetchImplementation: jest.fn() as unknown as typeof fetch, storage });
    expect(client.auth).toBeDefined();

    const lifecycleClient = createClientMock();
    let emitState: (state: AppStateStatus) => void = () => undefined;
    const remove = jest.fn();
    const cleanup = registerAuthAutoRefresh(lifecycleClient, {
      addEventListener: (_event, nextListener) => {
        emitState = nextListener;
        return { remove };
      },
    });
    emitState("active");
    emitState("background");
    cleanup();
    expect(lifecycleClient.auth.startAutoRefresh).toHaveBeenCalled();
    expect(lifecycleClient.auth.stopAutoRefresh).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
