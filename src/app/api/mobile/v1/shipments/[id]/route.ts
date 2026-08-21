import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { shipmentEvents, shipments } from "@/lib/db/schema";
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
      .select()
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
