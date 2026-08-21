import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  customerAccessRequests,
  customerAccounts,
  freightRequests,
  organizationMemberships,
  outboxEvents,
  users,
} from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { idempotencyKeySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const querySchema = z
  .object({
    status: z
      .enum(["pending", "approved", "rejected", "cancelled"])
      .default("pending"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
const decisionSchema = z
  .object({
    accessRequestId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    customerAccountId: z.uuid().optional(),
    reviewNotes: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "approve" && !value.customerAccountId) {
      context.addIssue({
        code: "custom",
        path: ["customerAccountId"],
        message: "Approval requires a linked customer account.",
      });
    }
  });
type ReviewDecision = z.output<typeof decisionSchema>;

async function loadPendingAccessRequest(
  transaction: Transaction,
  organizationId: string,
  accessRequestId: string,
) {
  const [accessRequest] = await transaction
    .select({
      id: customerAccessRequests.id,
      userId: customerAccessRequests.userId,
      membershipId: customerAccessRequests.membershipId,
      status: customerAccessRequests.status,
    })
    .from(customerAccessRequests)
    .where(
      and(
        eq(customerAccessRequests.id, accessRequestId),
        eq(customerAccessRequests.organizationId, organizationId),
      ),
    )
    .for("update");
  if (!accessRequest) {
    throw new MobileApiError(
      404,
      "NOT_FOUND",
      "Customer access request not found.",
    );
  }
  if (accessRequest.status !== "pending") {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "The customer access request has already been reviewed.",
    );
  }
  return accessRequest;
}

async function linkedCustomerAccount(
  transaction: Transaction,
  organizationId: string,
  input: ReviewDecision,
): Promise<string | null> {
  if (input.decision === "reject") return null;
  if (!input.customerAccountId) {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      "Approval requires a linked customer account.",
    );
  }
  const [account] = await transaction
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.id, input.customerAccountId),
        eq(customerAccounts.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!account) {
    throw new MobileApiError(
      404,
      "NOT_FOUND",
      "Customer account not found in this organization.",
    );
  }
  return account.id;
}

async function hasActiveDefaultMembership(
  transaction: Transaction,
  userId: string,
): Promise<boolean> {
  const [existingDefault] = await transaction
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, "active"),
        eq(organizationMemberships.isDefault, true),
      ),
    )
    .limit(1);
  return Boolean(existingDefault);
}

async function transitionPendingMembership(
  transaction: Transaction,
  organizationId: string,
  accessRequest: Awaited<ReturnType<typeof loadPendingAccessRequest>>,
  linkedCustomerAccountId: string | null,
  reviewedAt: Date,
): Promise<void> {
  const approved = linkedCustomerAccountId !== null;
  const hasDefault = await hasActiveDefaultMembership(
    transaction,
    accessRequest.userId,
  );
  const [membership] = await transaction
    .update(organizationMemberships)
    .set({
      status: approved ? "active" : "revoked",
      customerAccountId: linkedCustomerAccountId,
      isDefault: approved && !hasDefault,
      updatedAt: reviewedAt,
    })
    .where(
      and(
        eq(organizationMemberships.id, accessRequest.membershipId),
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, accessRequest.userId),
        eq(organizationMemberships.role, "customer"),
        eq(organizationMemberships.status, "pending"),
      ),
    )
    .returning({ id: organizationMemberships.id });
  if (!membership) {
    throw new MobileApiError(
      409,
      "CONFLICT",
      "The pending customer membership is no longer reviewable.",
    );
  }
}

async function backfillPendingFreightRequests(
  transaction: Transaction,
  organizationId: string,
  userId: string,
  customerAccountId: string | null,
  reviewedAt: Date,
): Promise<void> {
  if (!customerAccountId) return;
  await transaction
    .update(freightRequests)
    .set({ customerAccountId, updatedAt: reviewedAt })
    .where(
      and(
        eq(freightRequests.organizationId, organizationId),
        eq(freightRequests.createdByUserId, userId),
        isNull(freightRequests.customerAccountId),
      ),
    );
}

async function recordAccessDecision(
  transaction: Transaction,
  organizationId: string,
  reviewerUserId: string,
  accessRequest: Awaited<ReturnType<typeof loadPendingAccessRequest>>,
  input: ReviewDecision,
  linkedCustomerAccountId: string | null,
  reviewedAt: Date,
): Promise<void> {
  const approved = input.decision === "approve";
  await transaction
    .update(customerAccessRequests)
    .set({
      status: approved ? "approved" : "rejected",
      linkedCustomerAccountId,
      reviewedByUserId: reviewerUserId,
      reviewNotes: input.reviewNotes,
      reviewedAt,
      updatedAt: reviewedAt,
    })
    .where(eq(customerAccessRequests.id, accessRequest.id));
  await transaction.insert(outboxEvents).values({
    organizationId,
    topic: approved ? "customer_access.approved" : "customer_access.rejected",
    aggregateType: "customer_access_request",
    aggregateId: accessRequest.id,
    deduplicationKey: `customer-access:${accessRequest.id}:${input.decision}`,
    payload: {
      accessRequestId: accessRequest.id,
      userId: accessRequest.userId,
      customerAccountId: linkedCustomerAccountId,
    },
  });
}

async function reviewCustomerAccess(
  transaction: Transaction,
  organizationId: string,
  reviewerUserId: string,
  input: ReviewDecision,
) {
  const accessRequest = await loadPendingAccessRequest(
    transaction,
    organizationId,
    input.accessRequestId,
  );
  const customerAccountId = await linkedCustomerAccount(
    transaction,
    organizationId,
    input,
  );
  const reviewedAt = new Date();
  await transitionPendingMembership(
    transaction,
    organizationId,
    accessRequest,
    customerAccountId,
    reviewedAt,
  );
  await backfillPendingFreightRequests(
    transaction,
    organizationId,
    accessRequest.userId,
    customerAccountId,
    reviewedAt,
  );
  await recordAccessDecision(
    transaction,
    organizationId,
    reviewerUserId,
    accessRequest,
    input,
    customerAccountId,
    reviewedAt,
  );
  return {
    id: accessRequest.id,
    status: input.decision === "approve" ? "approved" : "rejected",
    reviewedAt: reviewedAt.toISOString(),
  };
}

function requireIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!parsed.success) {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      "A valid Idempotency-Key header is required.",
    );
  }
  return parsed.data;
}

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireMfa: true,
    rateLimit: { scope: "customer-access.list", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const query = parseStrictQuery(request, querySchema, authorization.requestId);
  if (!query.success) return query.response;
  try {
    const rows = await db
      .select({
        id: customerAccessRequests.id,
        userId: customerAccessRequests.userId,
        email: users.email,
        requestedCompanyName: customerAccessRequests.requestedCompanyName,
        status: customerAccessRequests.status,
        linkedCustomerAccountId:
          customerAccessRequests.linkedCustomerAccountId,
        requestedAt: customerAccessRequests.requestedAt,
        reviewedAt: customerAccessRequests.reviewedAt,
      })
      .from(customerAccessRequests)
      .innerJoin(users, eq(customerAccessRequests.userId, users.id))
      .where(
        and(
          eq(
            customerAccessRequests.organizationId,
            authorization.principal.organizationId,
          ),
          eq(customerAccessRequests.status, query.data.status),
        ),
      )
      .orderBy(asc(customerAccessRequests.requestedAt))
      .limit(query.data.limit);
    return mergeResponseHeaders(
      apiSuccess(rows, authorization.requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(
      error,
      authorization.requestId,
      "customer-access.list",
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireMfa: true,
    rateLimit: { scope: "customer-access.review", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const body = await parseStrictJson(
    request,
    decisionSchema,
    authorization.requestId,
  );
  if (!body.success) return body.response;
  try {
    const idempotencyKey = requireIdempotencyKey(request);
    const result = await executeIdempotentMutation(
      {
        principal: authorization.principal,
        idempotencyKey,
        operation: "customer_access.review",
        payload: body.data,
      },
      async (transaction) => ({
        status: 200,
        data: await reviewCustomerAccess(
          transaction,
          authorization.principal.organizationId,
          authorization.principal.userId,
          body.data,
        ),
      }),
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, authorization.requestId, {
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(
      error,
      authorization.requestId,
      "customer-access.review",
    );
  }
}
