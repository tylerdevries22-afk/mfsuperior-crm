import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverAvailabilityBlocks } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { availabilityBlockAccessPredicate } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Removal is a POST rather than a DELETE so it replays through the same
 * offline mutation queue every other driver write uses.
 */
export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.availability.remove", limit: 60, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const blockId = parseRouteId((await context.params).id, requestId, "availability block ID");
  if (!blockId.success) return blockId.response;

  try {
    // The access predicate is the only scoping here: a driver can only ever
    // delete a row that already matched their own id.
    const [row] = await db
      .delete(driverAvailabilityBlocks)
      .where(and(
        eq(driverAvailabilityBlocks.id, blockId.id),
        availabilityBlockAccessPredicate(principal),
      ))
      .returning({ id: driverAvailabilityBlocks.id });

    if (!row) {
      throw new MobileApiError(404, "NOT_FOUND", "That availability block could not be found.");
    }
    return mergeResponseHeaders(
      apiSuccess({ id: row.id }, requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability.remove");
  }
}
