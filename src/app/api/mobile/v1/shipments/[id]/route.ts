import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  shipmentEvents,
  shipmentExternalReferences,
  shipments,
} from "@/lib/db/schema";
import { shipmentAccessPredicate } from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  apiError,
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
} from "@/lib/mobile-api/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) {
    return apiError(
      400,
      { code: "VALIDATION_ERROR", message: "The shipment ID is invalid." },
      authorization.requestId,
    );
  }

  try {
    const [shipment] = await db
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
        billOfLadingNumber: shipments.bolNumber,
        proNumber: shipments.proNumber,
        origin: shipments.origin,
        destination: shipments.destination,
        intermediateStops: shipments.intermediateStops,
        commodity: shipments.commodity,
        weightPounds: shipments.weightLbs,
        palletCount: shipments.palletCount,
        equipmentType: shipments.equipmentType,
        specialInstructions: shipments.specialInstructions,
        rateCents: shipments.rateCents,
        fuelSurchargeCents: shipments.fuelSurchargeCents,
        accessorialsCents: shipments.accessorialsCents,
        status: shipments.status,
        statusCode: shipments.statusCode,
        estimatedPickupAt: shipments.estimatedPickupAt,
        estimatedDeliveryAt: shipments.estimatedDeliveryAt,
        pickedUpAt: shipments.pickedUpAt,
        deliveredAt: shipments.deliveredAt,
        source: shipments.source,
        createdAt: shipments.createdAt,
        updatedAt: shipments.updatedAt,
      })
      .from(shipments)
      .where(
        and(
          eq(shipments.id, id.data),
          shipmentAccessPredicate(authorization.principal),
        ),
      )
      .limit(1);
    if (!shipment) {
      return apiError(
        404,
        { code: "NOT_FOUND", message: "Shipment not found." },
        authorization.requestId,
      );
    }
    const events = await db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipment.id))
      .orderBy(desc(shipmentEvents.recordedAt))
      .limit(200);
    return mergeResponseHeaders(
      apiSuccess({ ...shipment, events }, authorization.requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "shipments.detail");
  }
}
