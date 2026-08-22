import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverPayoutMethods } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { payoutMethodWriteSchema } from "@/lib/mobile-api/contracts";
import { requireCarrierId, requireDriverId } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
} from "@/lib/mobile-api/http";

/**
 * A driver's payout handles.
 *
 * Driver-only, and always scoped to the caller's own driver id — there is no
 * query parameter here that could name somebody else, and no admin role that
 * can read this endpoint at all. The handle is an account identifier a driver
 * publishes anyway, never a card or bank account number, but it is the one
 * field that would let another person be paid in their place.
 */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["driver"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  try {
    const driverId = requireDriverId(principal);
    const rows = await db
      .select()
      .from(driverPayoutMethods)
      .where(eq(driverPayoutMethods.driverId, driverId))
      .orderBy(asc(driverPayoutMethods.rail));

    return mergeResponseHeaders(
      apiSuccess(rows.map(toPayoutMethod), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payout-methods.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["driver"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.payout-methods.write", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, payoutMethodWriteSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireCarrierId(principal);
    const driverId = requireDriverId(principal);

    const saved = await db.transaction(async (transaction) => {
      const existing = await transaction
        .select({ id: driverPayoutMethods.id })
        .from(driverPayoutMethods)
        .where(eq(driverPayoutMethods.driverId, driverId));
      // The first handle a driver saves becomes their default; after that it
      // only moves when they say so.
      const isDefault = body.data.isDefault ?? existing.length === 0;

      if (isDefault) {
        // Cleared first because the partial unique index allows only one
        // default row per driver, so an upsert would otherwise collide.
        await transaction
          .update(driverPayoutMethods)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(driverPayoutMethods.driverId, driverId));
      }

      const values = {
        carrierId,
        driverId,
        handle: body.data.handle,
        isDefault,
        label: body.data.label ?? null,
        rail: body.data.rail,
        updatedAt: new Date(),
      };

      // One handle per rail: replacing a Venmo handle means exactly that, not
      // a second Venmo row a settlement could pick between.
      const [row] = await transaction
        .insert(driverPayoutMethods)
        .values(values)
        .onConflictDoUpdate({
          set: values,
          target: [driverPayoutMethods.driverId, driverPayoutMethods.rail],
        })
        .returning();
      return row;
    });

    return mergeResponseHeaders(
      apiSuccess(toPayoutMethod(saved), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payout-methods.write");
  }
}

export function toPayoutMethod(row: typeof driverPayoutMethods.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    driverId: row.driverId,
    handle: row.handle,
    id: row.id,
    isDefault: row.isDefault,
    label: row.label,
    rail: row.rail,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shared by the two id-scoped routes below. */
export async function listOwnMethods(driverId: string) {
  const rows = await db
    .select()
    .from(driverPayoutMethods)
    .where(eq(driverPayoutMethods.driverId, driverId))
    .orderBy(asc(driverPayoutMethods.rail));
  return rows.map(toPayoutMethod);
}

export function ownMethodPredicate(driverId: string, methodId: string) {
  return and(
    eq(driverPayoutMethods.id, methodId),
    eq(driverPayoutMethods.driverId, driverId),
  );
}
