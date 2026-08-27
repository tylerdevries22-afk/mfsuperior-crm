import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { scheduleSyncStatuses } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { availabilityQuerySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { syncAccessPredicate, toScheduleSyncStatus } from "@/lib/mobile-api/schedule";

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, availabilityQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const rows = await db
      .select()
      .from(scheduleSyncStatuses)
      .where(syncAccessPredicate(principal))
      .orderBy(desc(scheduleSyncStatuses.updatedAt))
      .limit(query.data.limit);
    return mergeResponseHeaders(
      apiSuccess(rows.map(toScheduleSyncStatus), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "schedule-sync.list");
  }
}
