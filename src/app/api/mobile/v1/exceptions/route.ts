import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { shipmentEvents, shipments } from "@/lib/db/schema";
import { shipmentAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { mobileExceptionQuerySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

const resolutions = alias(shipmentEvents, "exception_resolutions");

/**
 * Exception reports are shipment events. A report is open until a matching
 * `exception_resolved` event carries its id in `status_reason`.
 */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, mobileExceptionQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const filters = [
      eq(shipmentEvents.eventType, "exception_reported"),
      shipmentAccessPredicate(principal),
    ];
    if (query.data.status === "open") {
      filters.push(sql`${resolutions.id} is null`);
    } else if (query.data.status === "resolved") {
      filters.push(sql`${resolutions.id} is not null`);
    }
    const rows = await db
      .select({
        id: shipmentEvents.id,
        shipmentId: shipmentEvents.shipmentId,
        severity: shipmentEvents.eventCode,
        category: shipmentEvents.statusReason,
        description: shipmentEvents.notes,
        photoUrls: shipmentEvents.photoUrls,
        reportedAt: shipmentEvents.recordedAt,
        reportedByDriverId: shipmentEvents.driverId,
        resolutionNote: resolutions.notes,
        resolvedAt: resolutions.recordedAt,
      })
      .from(shipmentEvents)
      .innerJoin(shipments, eq(shipments.id, shipmentEvents.shipmentId))
      .leftJoin(
        resolutions,
        and(
          eq(resolutions.eventType, "exception_resolved"),
          sql`${resolutions.statusReason} = ${shipmentEvents.id}::text`,
        ),
      )
      .where(and(...filters))
      .orderBy(desc(shipmentEvents.recordedAt))
      .limit(query.data.limit);

    return mergeResponseHeaders(
      apiSuccess(
        rows.map((row) => ({
          id: row.id,
          shipmentId: row.shipmentId,
          severity: row.severity,
          category: row.category,
          description: row.description,
          photoUrls: row.photoUrls,
          reportedAt: row.reportedAt.toISOString(),
          reportedByDriverId: row.reportedByDriverId,
          resolutionNote: row.resolutionNote,
          resolvedAt: row.resolvedAt?.toISOString() ?? null,
          status: row.resolvedAt ? "resolved" : "open",
        })),
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "exceptions.list");
  }
}
