import { and, eq } from "drizzle-orm";
import {
  operationsMessageReads,
  operationsMessages,
} from "@/lib/db/schema";
import { operationsMessageAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  parseRouteId,
  requireIdempotencyKey,
} from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.messages.read", limit: 120, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const messageId = parseRouteId((await context.params).id, requestId, "message ID");
  if (!messageId.success) return messageId.response;
  const idempotency = requireIdempotencyKey(request, requestId);
  if (!idempotency.success) return idempotency.response;

  try {
    const result = await executeIdempotentMutation(
      {
        principal,
        idempotencyKey: idempotency.key,
        operation: "operations_message.read",
        payload: { messageId: messageId.id },
      },
      async (transaction) => {
        const [message] = await transaction
          .select({ id: operationsMessages.id })
          .from(operationsMessages)
          .where(
            and(
              eq(operationsMessages.id, messageId.id),
              operationsMessageAccessPredicate(principal),
            ),
          )
          .limit(1);
        if (!message) {
          throw new MobileApiError(404, "NOT_FOUND", "Message not found.");
        }
        const [read] = await transaction
          .insert(operationsMessageReads)
          .values({ messageId: message.id, userId: principal.userId })
          .onConflictDoNothing()
          .returning({ readAt: operationsMessageReads.readAt });
        return {
          status: 200,
          data: {
            id: message.id,
            userId: principal.userId,
            readAt: (read?.readAt ?? new Date()).toISOString(),
          },
        };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, requestId, {
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "messages.read");
  }
}
