import { db } from "@/lib/db/client";
import { mobilePushTokens } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { notificationTokenSchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
} from "@/lib/mobile-api/http";

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.notification_tokens", limit: 10, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, notificationTokenSchema, requestId);
  if (!body.success) return body.response;

  try {
    const [token] = await db
      .insert(mobilePushTokens)
      .values({
        expoPushToken: body.data.token,
        organizationId: principal.organizationId,
        platform: body.data.platform,
        updatedAt: new Date(),
        userId: principal.userId,
      })
      .onConflictDoUpdate({
        set: { isActive: true, platform: body.data.platform, updatedAt: new Date() },
        target: [mobilePushTokens.organizationId, mobilePushTokens.userId, mobilePushTokens.expoPushToken],
      })
      .returning({ id: mobilePushTokens.id });
    return mergeResponseHeaders(
      apiSuccess({ registered: Boolean(token) }, requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "notification_tokens.register");
  }
}
