import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, shipmentEvents, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  parseJsonBody,
  parseQuery,
  requireCarrierDispatcher,
  successResponse,
} from "../_lib/http";
import {
  shipmentCreateSchema,
  shipmentListQuerySchema,
  type ShipmentListQuery,
} from "../_lib/validation";

function searchPattern(query: string) {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

function shipmentFilters(query: ShipmentListQuery) {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(shipments.status, query.status));
  if (query.partner) filters.push(eq(shipments.partnerSlug, query.partner));
  if (query.q) {
    const needle = searchPattern(query.q);
    const search = or(
      ilike(shipments.targetLoadId, needle),
      ilike(shipments.targetPoNumber, needle),
      ilike(shipments.bolNumber, needle),
      ilike(shipments.proNumber, needle),
      sql`${shipments.origin}->>'city' ilike ${needle}`,
      sql`${shipments.destination}->>'city' ilike ${needle}`,
    );
    if (search) filters.push(search);
  }
  return filters.length ? and(...filters) : undefined;
}

async function listShipments(query: ShipmentListQuery) {
  const where = shipmentFilters(query);
  const offset = (query.page - 1) * query.limit;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: shipments.id,
        carrierId: shipments.carrierId,
        driverId: shipments.driverId,
        partnerSlug: shipments.partnerSlug,
        targetLoadId: shipments.targetLoadId,
        targetPoNumber: shipments.targetPoNumber,
        bolNumber: shipments.bolNumber,
        proNumber: shipments.proNumber,
        scac: shipments.scac,
        origin: shipments.origin,
        destination: shipments.destination,
        intermediateStops: shipments.intermediateStops,
        commodity: shipments.commodity,
        weightLbs: shipments.weightLbs,
        palletCount: shipments.palletCount,
        equipmentType: shipments.equipmentType,
        rateCents: shipments.rateCents,
        fuelSurchargeCents: shipments.fuelSurchargeCents,
        accessorialsCents: shipments.accessorialsCents,
        status: shipments.status,
        estimatedPickupAt: shipments.estimatedPickupAt,
        estimatedDeliveryAt: shipments.estimatedDeliveryAt,
        pickedUpAt: shipments.pickedUpAt,
        deliveredAt: shipments.deliveredAt,
        source: shipments.source,
        createdAt: shipments.createdAt,
        updatedAt: shipments.updatedAt,
      })
      .from(shipments)
      .where(where)
      .orderBy(desc(shipments.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shipments)
      .where(where),
  ]);
  return { rows, total: Number(totalRow.count) };
}

export async function GET(request: Request) {
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const query = parseQuery(request, shipmentListQuerySchema);
  if (!query.success) return query.response;

  try {
    const { rows, total } = await listShipments(query.data);
    return successResponse(rows, {
      page: query.data.page,
      limit: query.data.limit,
      total,
      totalPages: Math.ceil(total / query.data.limit),
    });
  } catch (error) {
    return databaseErrorResponse(error, "shipments.list");
  }
}

export async function POST(request: Request) {
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const body = await parseJsonBody(request, shipmentCreateSchema);
  if (!body.success) return body.response;

  try {
    const shipment = await db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(shipments)
        .values(body.data)
        .returning();
      await transaction.insert(shipmentEvents).values({
        shipmentId: created.id,
        driverId: created.driverId,
        eventType: "created",
        eventCode: created.statusCode,
        notes: "Shipment created through the carrier workspace.",
      });
      await transaction.insert(auditLog).values({
        actorUserId: authorization.principal.userId,
        entity: "shipment",
        entityId: created.id,
        action: "create",
        beforeJson: null,
        afterJson: body.data,
      });
      return created;
    });
    return successResponse(shipment, null, 201);
  } catch (error) {
    return databaseErrorResponse(error, "shipments.create");
  }
}
