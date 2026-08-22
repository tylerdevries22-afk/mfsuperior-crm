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
import { listOwnMethods, ownMethodPredicate } from "../../route";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.payout-methods.remove", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const methodId = parseRouteId((await context.params).id, requestId, "payout method ID");
  if (!methodId.success) return methodId.response;

  try {
    const driverId = requireDriverId(principal);
    await db.transaction(async (transaction) => {
      const [removed] = await transaction
        .delete(driverPayoutMethods)
        .where(ownMethodPredicate(driverId, methodId.id))
        .returning({ isDefault: driverPayoutMethods.isDefault });
      if (!removed) {
        throw new MobileApiError(404, "NOT_FOUND", "That payout method could not be found.");
      }

      if (removed.isDefault) {
        // Removing the default promotes whatever remains, rather than leaving
        // the driver with handles and nothing marked to pay.
        const [next] = await transaction
          .select({ id: driverPayoutMethods.id })
          .from(driverPayoutMethods)
          .where(eq(driverPayoutMethods.driverId, driverId))
          .limit(1);
        if (next) {
          await transaction
            .update(driverPayoutMethods)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(driverPayoutMethods.id, next.id));
        }
      }
    });

    return mergeResponseHeaders(
      apiSuccess(await listOwnMethods(driverId), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payout-methods.remove");
  }
}
