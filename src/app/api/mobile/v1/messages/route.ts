import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  operationsMessageReads,
  operationsMessages,
  organizationMemberships,
  shipments,
} from "@/lib/db/schema";
import {
  operationsMessageAccessPredicate,
  shipmentAccessPredicate,
} from "@/lib/mobile-api/access";
import {
  authorizeMobileRequest,
  type MobilePrincipal,
} from "@/lib/mobile-api/authorize";
import {
  mobileMessageQuerySchema,
  operationsMessageCreateSchema,
} from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  requireIdempotencyKey,
  type MobileTransaction,
} from "@/lib/mobile-api/shipment-mutations";

type MessageRow = {
  id: string;
  threadKey: string;
  threadKind: "shipment" | "dispatch" | "support";
  shipmentId: string | null;
  senderUserId: string;
  recipientUserIds: unknown;
  body: string;
  sentAt: Date;
};

function messageResponse(row: MessageRow, readByUserIds: readonly string[]) {
  return {
    id: row.id,
    threadKey: row.threadKey,
    threadKind: row.threadKind,
    shipmentId: row.shipmentId,
    senderUserId: row.senderUserId,
    recipientUserIds: Array.isArray(row.recipientUserIds)
      ? row.recipientUserIds.filter((value): value is string => typeof value === "string")
      : [],
    body: row.body,
    sentAt: row.sentAt.toISOString(),
    readByUserIds: [...readByUserIds],
  };
}

/** Recipients must be active members of the sender's own organization. */
async function requireOrganizationRecipients(
  transaction: MobileTransaction,
  principal: MobilePrincipal,
  recipientUserIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(recipientUserIds)].filter(
    (userId) => userId !== principal.userId,
  );
  if (unique.length === 0) {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      "Choose at least one other recipient.",
    );
  }
  const members = await transaction
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, principal.organizationId),
        eq(organizationMemberships.status, "active"),
        inArray(organizationMemberships.userId, unique),
      ),
    );
  if (members.length !== unique.length) {
    throw new MobileApiError(
      403,
      "TENANT_ACCESS_DENIED",
      "Every recipient must be an active member of this organization.",
    );
  }
  return unique;
}

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, mobileMessageQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const filters = [operationsMessageAccessPredicate(principal)];
    if (query.data.threadKey) {
      filters.push(eq(operationsMessages.threadKey, query.data.threadKey));
    }
    const rows = await db
      .select({
        id: operationsMessages.id,
        threadKey: operationsMessages.threadKey,
        threadKind: operationsMessages.threadKind,
        shipmentId: operationsMessages.shipmentId,
        senderUserId: operationsMessages.senderUserId,
        recipientUserIds: operationsMessages.recipientUserIds,
        body: operationsMessages.body,
        sentAt: operationsMessages.sentAt,
      })
      .from(operationsMessages)
      .where(and(...filters))
      .orderBy(desc(operationsMessages.sentAt))
      .limit(query.data.limit);
    const reads = rows.length
      ? await db
          .select({
            messageId: operationsMessageReads.messageId,
            userId: operationsMessageReads.userId,
          })
          .from(operationsMessageReads)
          .where(
            inArray(
              operationsMessageReads.messageId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    const readsByMessage = new Map<string, string[]>();
    for (const read of reads) {
      readsByMessage.set(read.messageId, [
        ...(readsByMessage.get(read.messageId) ?? []),
        read.userId,
      ]);
    }
    return mergeResponseHeaders(
      apiSuccess(
        rows.map((row) => messageResponse(row, readsByMessage.get(row.id) ?? [])),
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "messages.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.messages.send", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(
    request,
    operationsMessageCreateSchema,
    requestId,
  );
  if (!body.success) return body.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "operations_message.send",
        payload: body.data,
      },
      async (transaction) => {
        const recipientUserIds = await requireOrganizationRecipients(
          transaction,
          principal,
          body.data.recipientUserIds,
        );
        if (body.data.shipmentId) {
          const [shipment] = await transaction
            .select({ id: shipments.id })
            .from(shipments)
            .where(
              and(
                eq(shipments.id, body.data.shipmentId),
                shipmentAccessPredicate(principal),
              ),
            )
            .limit(1);
          if (!shipment) {
            throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
          }
        }
        const [created] = await transaction
          .insert(operationsMessages)
          .values({
            organizationId: principal.organizationId,
            threadKey: body.data.threadKey,
            threadKind: body.data.threadKind,
            shipmentId: body.data.shipmentId ?? null,
            senderUserId: principal.userId,
            recipientUserIds: sql`${JSON.stringify(recipientUserIds)}::jsonb`,
            body: body.data.body,
          })
          .returning({
            id: operationsMessages.id,
            threadKey: operationsMessages.threadKey,
            threadKind: operationsMessages.threadKind,
            shipmentId: operationsMessages.shipmentId,
            senderUserId: operationsMessages.senderUserId,
            recipientUserIds: operationsMessages.recipientUserIds,
            body: operationsMessages.body,
            sentAt: operationsMessages.sentAt,
          });
        // The sender has necessarily read what they just sent.
        await transaction
          .insert(operationsMessageReads)
          .values({ messageId: created.id, userId: principal.userId })
          .onConflictDoNothing();
        return {
          status: 201,
          data: messageResponse(created, [principal.userId]),
        };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, {
        status: result.status,
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "messages.send");
  }
}
