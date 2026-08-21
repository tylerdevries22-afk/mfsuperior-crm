import { and, asc, eq, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  freightDocuments,
  freightLocations,
  freightRequests,
  mobileSyncStates,
  shipments,
} from "@/lib/db/schema";
import {
  documentAccessPredicate,
  freightRequestAccessPredicate,
  shipmentAccessPredicate,
} from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { mobileSyncQuerySchema } from "@/lib/mobile-api/contracts";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictQuery,
} from "@/lib/mobile-api/http";
import { decodeSyncCursor, encodeSyncCursor } from "@/lib/mobile-api/sync-cursor";

const SYNC_ENTITY_LIMIT = 2_000;

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.sync", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const query = parseStrictQuery(
    request,
    mobileSyncQuerySchema,
    authorization.requestId,
  );
  if (!query.success) return query.response;

  try {
    const since = query.data.cursor
      ? decodeSyncCursor(query.data.cursor)
      : new Date(0);
    const highWatermark = new Date();
    const shipmentFilter = and(
      shipmentAccessPredicate(authorization.principal),
      gt(shipments.updatedAt, since),
      lte(shipments.updatedAt, highWatermark),
    );
    const requestFilter = and(
      freightRequestAccessPredicate(authorization.principal),
      gt(freightRequests.updatedAt, since),
      lte(freightRequests.updatedAt, highWatermark),
    );
    const documentFilter = and(
      documentAccessPredicate(authorization.principal),
      gt(freightDocuments.updatedAt, since),
      lte(freightDocuments.updatedAt, highWatermark),
    );
    const locationFilter = and(
      eq(freightLocations.organizationId, authorization.principal.organizationId),
      gt(freightLocations.updatedAt, since),
      lte(freightLocations.updatedAt, highWatermark),
    );
    const [shipmentRows, requestRows, documentRows, locationRows] =
      await Promise.all([
        db
          .select()
          .from(shipments)
          .where(shipmentFilter)
          .orderBy(asc(shipments.updatedAt), asc(shipments.id))
          .limit(SYNC_ENTITY_LIMIT + 1),
        db
          .select()
          .from(freightRequests)
          .where(requestFilter)
          .orderBy(asc(freightRequests.updatedAt), asc(freightRequests.id))
          .limit(SYNC_ENTITY_LIMIT + 1),
        db
          .select()
          .from(freightDocuments)
          .where(documentFilter)
          .orderBy(asc(freightDocuments.updatedAt), asc(freightDocuments.id))
          .limit(SYNC_ENTITY_LIMIT + 1),
        db
          .select()
          .from(freightLocations)
          .where(locationFilter)
          .orderBy(asc(freightLocations.updatedAt), asc(freightLocations.id))
          .limit(SYNC_ENTITY_LIMIT + 1),
      ]);
    const requiresFullSync = [
      shipmentRows,
      requestRows,
      documentRows,
      locationRows,
    ].some((rows) => rows.length > SYNC_ENTITY_LIMIT);
    const nextCursor = requiresFullSync
      ? query.data.cursor ?? null
      : encodeSyncCursor(highWatermark);

    if (!requiresFullSync) {
      await db
        .insert(mobileSyncStates)
        .values({
          organizationId: authorization.principal.organizationId,
          userId: authorization.principal.userId,
          deviceId: query.data.deviceId,
          cursor: nextCursor,
          lastSyncedAt: highWatermark,
          updatedAt: highWatermark,
        })
        .onConflictDoUpdate({
          target: [
            mobileSyncStates.organizationId,
            mobileSyncStates.userId,
            mobileSyncStates.deviceId,
          ],
          set: {
            cursor: nextCursor,
            lastSyncedAt: highWatermark,
            updatedAt: highWatermark,
          },
        });
    }

    return mergeResponseHeaders(
      apiSuccess(
        {
          cursor: nextCursor,
          requiresFullSync,
          serverTime: highWatermark.toISOString(),
          changes: {
            shipments: shipmentRows.slice(0, SYNC_ENTITY_LIMIT),
            requests: requestRows.slice(0, SYNC_ENTITY_LIMIT),
            documents: documentRows.slice(0, SYNC_ENTITY_LIMIT),
            locations: locationRows.slice(0, SYNC_ENTITY_LIMIT),
            tombstones: [],
          },
        },
        authorization.requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "sync.read");
  }
}
