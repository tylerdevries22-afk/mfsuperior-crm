import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverPayoutMethods } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { requireDriverId } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import {
  listOwnPayoutMethods,
  ownPayoutMethodPredicate,
} from "@/lib/mobile-api/route-serializers";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.payout-methods.default", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const methodId = parseRouteId((await context.params).id, requestId, "payout method ID");
  if (!methodId.success) return methodId.response;

  try {
    const driverId = requireDriverId(principal);
    await db.transaction(async (transaction) => {
      // Cleared before setting, because the partial unique index permits only
      // one default row per driver at a time.
      await transaction
        .update(driverPayoutMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(driverPayoutMethods.driverId, driverId));

      const [promoted] = await transaction
        .update(driverPayoutMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(ownPayoutMethodPredicate(driverId, methodId.id))
        .returning({ id: driverPayoutMethods.id });
      if (!promoted) {
        throw new MobileApiError(404, "NOT_FOUND", "That payout method could not be found.");
      }
    });

    return mergeResponseHeaders(
      apiSuccess(await listOwnPayoutMethods(driverId), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payout-methods.default");
  }
}
