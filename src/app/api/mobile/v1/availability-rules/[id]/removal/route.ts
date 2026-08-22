import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverAvailabilityBlocks, driverAvailabilityRules } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { availabilityRuleAccessPredicate } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.availability-rules.remove", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const ruleId = parseRouteId((await context.params).id, requestId, "availability rule ID");
  if (!ruleId.success) return ruleId.response;

  try {
    const removed = await db.transaction(async (transaction) => {
      const [rule] = await transaction
        .delete(driverAvailabilityRules)
        .where(and(
          eq(driverAvailabilityRules.id, ruleId.id),
          availabilityRuleAccessPredicate(principal),
        ))
        .returning({ id: driverAvailabilityRules.id });
      if (!rule) {
        return null;
      }
      // Blocks expanded from the pattern go with it. Leaving them behind would
      // keep enforcing a schedule the driver just deleted.
      await transaction
        .delete(driverAvailabilityBlocks)
        .where(eq(driverAvailabilityBlocks.ruleId, rule.id));
      return rule;
    });

    if (!removed) {
      throw new MobileApiError(404, "NOT_FOUND", "That weekly pattern could not be found.");
    }
    return mergeResponseHeaders(
      apiSuccess({ id: removed.id }, requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "availability-rules.remove");
  }
}
