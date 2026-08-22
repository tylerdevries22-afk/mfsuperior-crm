import { randomUUID } from "expo-crypto";

import { ACCESS_STATES, APP_ROLES, type AccessState, type AppRole } from "../../domain/types";
import { NetworkRequestError, type ApiClient } from "../network";
import { AuthRuntimeError } from "./errors";

export const MEMBERSHIP_STATUSES = ["active", "pending"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Server-derived membership. Supabase metadata never authorizes the client. */
export interface MembershipSnapshot {
  readonly accessState: AccessState;
  readonly carrierId: string | null;
  readonly customerAccountId: string | null;
  readonly driverId: string | null;
  readonly membershipStatus: MembershipStatus;
  readonly organizationId: string;
  readonly organizationSlug: string;
  readonly role: AppRole;
  readonly userId: string;
}

export interface MembershipSyncInput {
  readonly customerCompanyName?: string;
  readonly invitationToken?: string;
}

export interface MembershipSyncGateway {
  sync(input?: MembershipSyncInput): Promise<MembershipSnapshot>;
}

export interface ApiMembershipSyncGatewayOptions {
  readonly apiClient: ApiClient;
  readonly idFactory?: () => string;
}

/** POSTs `/api/auth/sync` and validates the payload before it can grant access. */
export class ApiMembershipSyncGateway implements MembershipSyncGateway {
  private readonly apiClient: ApiClient;
  private readonly idFactory: () => string;

  constructor(options: ApiMembershipSyncGatewayOptions) {
    this.apiClient = options.apiClient;
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async sync(input: MembershipSyncInput = {}): Promise<MembershipSnapshot> {
    const body = {
      ...(input.invitationToken ? { invitationToken: input.invitationToken } : {}),
      ...(input.customerCompanyName ? { customerCompanyName: input.customerCompanyName } : {}),
    };
    let payload: unknown;
    try {
      payload = await this.apiClient.requestJson<unknown>("sync", {
        body,
        idempotencyKey: this.idFactory(),
        method: "POST",
      });
    } catch (error: unknown) {
      throw toMembershipError(error);
    }
    return parseMembershipSnapshot(payload);
  }
}

/** Rejects any payload that could silently widen access. */
export function parseMembershipSnapshot(value: unknown): MembershipSnapshot {
  if (!isRecord(value)) {
    throw membershipError("Your workspace membership could not be confirmed.");
  }
  const role = APP_ROLES.find((candidate) => candidate === value.role);
  const membershipStatus = MEMBERSHIP_STATUSES.find(
    (candidate) => candidate === value.membershipStatus,
  );
  const accessState = ACCESS_STATES.find((candidate) => candidate === value.accessState);
  const userId = requiredString(value.userId);
  const organizationId = requiredString(value.organizationId);
  const organizationSlug = requiredString(value.organizationSlug);
  if (!role || !membershipStatus || !accessState || !userId || !organizationId || !organizationSlug) {
    throw membershipError("Your workspace membership could not be confirmed.");
  }
  if ((membershipStatus === "pending") !== (accessState === "pending_customer_approval")) {
    throw membershipError("Your workspace membership could not be confirmed.");
  }
  if (membershipStatus === "pending" && role !== "customer") {
    throw membershipError("Your workspace membership could not be confirmed.");
  }
  return {
    accessState,
    carrierId: optionalString(value.carrierId),
    customerAccountId: optionalString(value.customerAccountId),
    driverId: optionalString(value.driverId),
    membershipStatus,
    organizationId,
    organizationSlug,
    role,
    userId,
  };
}

function toMembershipError(error: unknown): AuthRuntimeError {
  if (error instanceof AuthRuntimeError) return error;
  if (error instanceof NetworkRequestError) {
    const status = error.failure.status;
    if (status === 401 || status === 403) {
      return membershipError(
        "This account is not assigned to an MF Superior Products workspace.",
      );
    }
    return new AuthRuntimeError({
      code: "AUTH_PROVIDER_FAILED",
      message: "Your workspace membership could not be confirmed. Please try again.",
      retryable: error.failure.retryable,
    });
  }
  return new AuthRuntimeError({
    code: "AUTH_PROVIDER_FAILED",
    message: "Your workspace membership could not be confirmed. Please try again.",
    retryable: true,
  });
}

function membershipError(message: string): AuthRuntimeError {
  return new AuthRuntimeError({ code: "ROLE_UNAUTHORIZED", message, retryable: false });
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown): string | null {
  return requiredString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
