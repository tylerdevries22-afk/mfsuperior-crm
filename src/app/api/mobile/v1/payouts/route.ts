import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { driverPayoutLineItems, driverPayouts, shipments } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { payoutIssueSchema, payoutQuerySchema } from "@/lib/mobile-api/contracts";
import { payoutAccessPredicate, requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { requireCarrierDriver } from "@/lib/mobile-api/shipment-mutations";
import { toPayout } from "@/lib/mobile-api/route-serializers";

/** The driver's share of a load's linehaul. Mirrors DRIVER_LINEHAUL_SHARE. */
const DRIVER_LINEHAUL_SHARE = 0.72;

/** Flat per-settlement deduction, carried as a negative line item. */
const OCCUPATIONAL_INSURANCE_CENTS = 6_240;

/**
 * Driver settlements.
 *
 * A driver reads their own ledger; an admin reads the carrier's and can issue.
 * A settlement names the rail a transfer went out on but never a handle, so
 * nothing on this endpoint exposes a driver's payment account to an admin.
 */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, payoutQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const filters = [payoutAccessPredicate(principal)];
    if (query.data.driverId) filters.push(eq(driverPayouts.driverId, query.data.driverId));
    if (query.data.status) filters.push(eq(driverPayouts.status, query.data.status));

    const rows = await db
      .select()
      .from(driverPayouts)
      .where(and(...filters))
      .orderBy(desc(driverPayouts.periodEnd))
      .limit(query.data.limit);

    const lineItems = rows.length === 0
      ? []
      : await db
          .select()
          .from(driverPayoutLineItems)
          .where(and(
            eq(driverPayoutLineItems.carrierId, rows[0].carrierId),
            inArray(driverPayoutLineItems.payoutId, rows.map((row) => row.id)),
          ))
          .orderBy(asc(driverPayoutLineItems.createdAt));

    return mergeResponseHeaders(
      apiSuccess(rows.map((row) => toPayout(row, lineItems)), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payouts.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    requireMfa: true,
    rateLimit: { scope: "mobile.payouts.issue", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, payoutIssueSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const periodStart = new Date(body.data.periodStart);
    const periodEnd = new Date(body.data.periodEnd);

    const issued = await db.transaction(async (transaction) => {
      await requireCarrierDriver(transaction, principal, body.data.driverId);

      // Two settlements covering one delivery would pay for it twice.
      const overlapping = await transaction
        .select({ id: driverPayouts.id })
        .from(driverPayouts)
        .where(and(
          eq(driverPayouts.driverId, body.data.driverId),
          eq(driverPayouts.carrierId, carrierId),
          lte(driverPayouts.periodStart, periodEnd),
          gte(driverPayouts.periodEnd, periodStart),
        ))
        .limit(1)
        .for("update");
      if (overlapping.length > 0) {
        throw new MobileApiError(
          409,
          "CONFLICT",
          "That period overlaps a settlement this driver already has.",
        );
      }

      const delivered = await transaction
        .select({
          accessorialsCents: shipments.accessorialsCents,
          deliveredAt: shipments.deliveredAt,
          id: shipments.id,
          rateCents: shipments.rateCents,
          targetLoadId: shipments.targetLoadId,
        })
        .from(shipments)
        .where(and(
          eq(shipments.carrierId, carrierId),
          eq(shipments.driverId, body.data.driverId),
          eq(shipments.status, "delivered"),
          gte(shipments.deliveredAt, periodStart),
          lte(shipments.deliveredAt, periodEnd),
        ))
        .orderBy(asc(shipments.deliveredAt));

      if (delivered.length === 0) {
        throw new MobileApiError(
          409,
          "CONFLICT",
          "That period has no delivered loads to settle.",
        );
      }

      type LineItemDraft = {
        readonly amountCents: number;
        readonly description: string;
        readonly kind: "linehaul" | "accessorial" | "deduction";
        readonly shipmentId: string | null;
      };

      const drafts: LineItemDraft[] = delivered.flatMap<LineItemDraft>((shipment) => {
        const rows: LineItemDraft[] = [{
          amountCents: Math.round((shipment.rateCents ?? 0) * DRIVER_LINEHAUL_SHARE),
          description: `${shipment.targetLoadId ?? shipment.id} · linehaul`,
          kind: "linehaul",
          shipmentId: shipment.id,
        }];
        if ((shipment.accessorialsCents ?? 0) > 0) {
          rows.push({
            amountCents: shipment.accessorialsCents ?? 0,
            description: `${shipment.targetLoadId ?? shipment.id} · accessorials`,
            kind: "accessorial",
            shipmentId: shipment.id,
          });
        }
        return rows;
      });
      drafts.push({
        amountCents: -OCCUPATIONAL_INSURANCE_CENTS,
        description: "Occupational accident coverage",
        kind: "deduction",
        shipmentId: null,
      });

      const grossCents = drafts
        .filter((draft) => draft.amountCents > 0)
        .reduce((sum, draft) => sum + draft.amountCents, 0);
      const deductionCents = -drafts
        .filter((draft) => draft.amountCents < 0)
        .reduce((sum, draft) => sum + draft.amountCents, 0);

      const [payout] = await transaction
        .insert(driverPayouts)
        .values({
          carrierId,
          deductionCents,
          driverId: body.data.driverId,
          grossCents,
          issuedAt: new Date(),
          // The database check constraint enforces this relationship too, so a
          // future change to the arithmetic cannot silently write a bad row.
          netCents: grossCents - deductionCents,
          periodEnd,
          periodStart,
          status: "pending",
        })
        .returning();

      const lineItems = await transaction
        .insert(driverPayoutLineItems)
        .values(drafts.map((draft) => ({
          amountCents: draft.amountCents,
          carrierId,
          description: draft.description,
          kind: draft.kind,
          payoutId: payout.id,
          shipmentId: draft.shipmentId,
        })))
        .returning();

      return { lineItems, payout };
    });

    return mergeResponseHeaders(
      apiSuccess(toPayout(issued.payout, issued.lineItems), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "payouts.issue");
  }
}
