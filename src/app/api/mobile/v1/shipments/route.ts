import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { shipmentExternalReferences, shipments } from "@/lib/db/schema";
import { shipmentAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { mobileShipmentQuerySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const query = parseStrictQuery(
    request,
    mobileShipmentQuerySchema,
    authorization.requestId,
  );
  if (!query.success) return query.response;

  const filters = [shipmentAccessPredicate(authorization.principal)];
  if (query.data.status) filters.push(eq(shipments.status, query.data.status));
  const where = and(...filters);
  const offset = (query.data.page - 1) * query.data.limit;
  try {
    const [rows, [count]] = await Promise.all([
      db
        .select({
          id: shipments.id,
          driverId: shipments.driverId,
          loadNumber: sql<string | null>`coalesce(
            (select ${shipmentExternalReferences.externalId}
             from ${shipmentExternalReferences}
             where ${shipmentExternalReferences.organizationId} = ${authorization.principal.organizationId}
               and ${shipmentExternalReferences.shipmentId} = ${shipments.id}
               and ${shipmentExternalReferences.referenceType} = 'load_number'
             order by ${shipmentExternalReferences.createdAt} asc
             limit 1),
            ${shipments.targetLoadId}
          )`,
          bolNumber: shipments.bolNumber,
          proNumber: shipments.proNumber,
          origin: shipments.origin,
          destination: shipments.destination,
          commodity: shipments.commodity,
          weightLbs: shipments.weightLbs,
          palletCount: shipments.palletCount,
          equipmentType: shipments.equipmentType,
          specialInstructions: shipments.specialInstructions,
          status: shipments.status,
          estimatedPickupAt: shipments.estimatedPickupAt,
          estimatedDeliveryAt: shipments.estimatedDeliveryAt,
          pickedUpAt: shipments.pickedUpAt,
          deliveredAt: shipments.deliveredAt,
          updatedAt: shipments.updatedAt,
        })
        .from(shipments)
        .where(where)
        .orderBy(desc(shipments.updatedAt))
        .limit(query.data.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(shipments)
        .where(where),
    ]);
    const total = Number(count.count);
    return mergeResponseHeaders(
      apiSuccess(rows, authorization.requestId, {
        meta: {
          page: query.data.page,
          limit: query.data.limit,
          total,
          totalPages: Math.ceil(total / query.data.limit),
        },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "shipments.list");
  }
}
