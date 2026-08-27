import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverPayoutLineItems, driverPayouts } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { payoutPaymentSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import { toPayout } from "@/lib/mobile-api/route-serializers";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Records that a settlement was paid on a rail.
 *
 * This moves no money and contacts no payment provider. It is the ledger
 * catching up with a transfer that happened in the driver's own payment app.
 * The body carries the rail only — a handle is neither accepted here nor
 * readable by the admin making the call.
 */
export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.payouts.payment", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  const payoutId = parseRouteId((await context.params).id, requestId, "settlement ID");
  if (!payoutId.success) return payoutId.response;
  const body = await parseStrictJson(request, payoutPaymentSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const updated = await db.transaction(async (transaction) => {
      const [payout] = await transaction
        .select()
        .from(driverPayouts)
        .where(and(eq(driverPayouts.id, payoutId.id), eq(driverPayouts.carrierId, carrierId)))
        .for("update");
      if (!payout) {
        throw new MobileApiError(404, "NOT_FOUND", "That settlement could not be found.");
      }
      if (payout.status === "paid") {
        throw new MobileApiError(
          409,
          "CONFLICT",
          "That settlement is already recorded as paid.",
        );
      }

      const [row] = await transaction
        .update(driverPayouts)
        .set({
          paidAt: new Date(),
          rail: body.data.rail,
          status: "paid",
          updatedAt: new Date(),
        })
        .where(and(eq(driverPayouts.id, payoutId.id), eq(driverPayouts.carrierId, carrierId)))
        .returning();
      return row;
    });

    const lineItems = await db
      .select()
      .from(driverPayoutLineItems)
      .where(eq(driverPayoutLineItems.payoutId, updated.id))
      .orderBy(asc(driverPayoutLineItems.createdAt));

    return mergeResponseHeaders(
      apiSuccess(toPayout(updated, lineItems), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payouts.payment");
  }
}
