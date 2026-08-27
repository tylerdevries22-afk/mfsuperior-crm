import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shiftCoverageRequests } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { availabilityQuerySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import {
  coverageAccessPredicate,
  toCoverageRequest,
} from "@/lib/mobile-api/schedule";

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
      .from(shiftCoverageRequests)
      .where(coverageAccessPredicate(principal))
      .orderBy(desc(shiftCoverageRequests.createdAt))
      .limit(query.data.limit);
    return mergeResponseHeaders(
      apiSuccess(rows.map(toCoverageRequest), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "shift-coverage.list");
  }
}
