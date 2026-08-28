import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  drivers,
  mobilePushTokens,
  organizationMemberships,
  users,
  vehicleTransferEvents,
  vehicles,
} from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { vehicleTransferSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import { parseRouteId } from "@/lib/mobile-api/shipment-mutations";
import { sendExpoPushNotification } from "@/lib/mobile-api/push";
import { toVehicle } from "@/lib/mobile-api/route-serializers";
import { signVehicleThumbnailReads } from "@/lib/mobile-api/upload-signer";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.vehicle_transfer", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const vehicleId = parseRouteId((await context.params).id, requestId, "vehicle ID");
  if (!vehicleId.success) return vehicleId.response;
  const body = await parseStrictJson(request, vehicleTransferSchema, requestId);
  if (!body.success) return body.response;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return apiFailureResponse(
      new MobileApiError(400, "VALIDATION_ERROR", "An Idempotency-Key header is required."),
      requestId,
      "vehicles.transfer",
    );
  }

  try {
    const carrierId = requireAdmin(principal);
    const result = await executeIdempotentMutation(
      {
        idempotencyKey,
        operation: "vehicle.transfer",
        payload: body.data,
        principal,
      },
      async (transaction) => {
        const [vehicle] = await transaction
          .select()
          .from(vehicles)
          .where(and(eq(vehicles.id, vehicleId.id), eq(vehicles.carrierId, carrierId)))
          .for("update");
        if (!vehicle) {
          throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found.");
        }
        if (vehicle.status !== "active") {
          throw new MobileApiError(409, "CONFLICT", "Only an active vehicle can be transferred.");
        }
        if (vehicle.assignedDriverId === body.data.targetDriverId) {
          throw new MobileApiError(409, "CONFLICT", "Choose a different driver for the transfer.");
        }

        const [target] = await transaction
          .select({
            authSubject: users.authSubject,
            firstName: drivers.firstName,
            id: drivers.id,
            lastName: drivers.lastName,
            userId: users.id,
          })
          .from(drivers)
          .innerJoin(
            organizationMemberships,
            and(
              eq(organizationMemberships.driverId, drivers.id),
              eq(organizationMemberships.organizationId, principal.organizationId),
              eq(organizationMemberships.role, "driver"),
              eq(organizationMemberships.status, "active"),
            ),
          )
          .innerJoin(users, eq(users.id, organizationMemberships.userId))
          .where(and(eq(drivers.id, body.data.targetDriverId), eq(drivers.carrierId, carrierId)));
        if (!target || !target.authSubject) {
          throw new MobileApiError(
            409,
            "CONFLICT",
            "That driver does not have an active signed-in account yet.",
          );
        }

        const [current] = vehicle.assignedDriverId
          ? await transaction
              .select({ firstName: drivers.firstName, lastName: drivers.lastName })
              .from(drivers)
              .where(and(eq(drivers.id, vehicle.assignedDriverId), eq(drivers.carrierId, carrierId)))
          : [];
        const [updated] = await transaction
          .update(vehicles)
          .set({ assignedDriverId: target.id, updatedAt: new Date() })
          .where(and(eq(vehicles.id, vehicle.id), eq(vehicles.carrierId, carrierId)))
          .returning();
        if (!updated) {
          throw new MobileApiError(404, "NOT_FOUND", "That vehicle could not be updated.");
        }

        const [event] = await transaction
          .insert(vehicleTransferEvents)
          .values({
            carrierId,
            fromDriverId: vehicle.assignedDriverId,
            fromDriverName: current ? `${current.firstName} ${current.lastName}` : null,
            note: body.data.note,
            organizationId: principal.organizationId,
            requestedByUserId: principal.userId,
            targetAuthSubject: target.authSubject,
            targetDriverId: target.id,
            targetDriverName: `${target.firstName} ${target.lastName}`,
            vehicleId: vehicle.id,
            vehicleUnitNumber: vehicle.unitNumber,
          })
          .returning({ id: vehicleTransferEvents.id });
        if (!event) {
          throw new MobileApiError(503, "DEPENDENCY_UNAVAILABLE", "The transfer event could not be recorded.");
        }
        return {
          status: 200,
          data: {
            eventId: event.id,
            targetUserId: target.userId,
            thumbnailPath: updated.thumbnailPath,
            vehicle: toVehicle(updated),
          },
        };
      },
    );

    if (!result.replayed) {
      try {
        await notifyTargetDriver(
          principal.organizationId,
          result.data.targetUserId,
          result.data.eventId,
          result.data.vehicle.id,
          result.data.vehicle.unitNumber,
          body.data.note,
        );
      } catch (error) {
        // The transfer is already committed and persisted for Realtime. A
        // transient push-token failure must not turn that success into an
        // ambiguous 5xx response that operators may repeat.
        console.error(JSON.stringify({
          severity: "error",
          event: "vehicle_transfer_push_failed",
          errorName: error instanceof Error ? error.name : "unknown",
          transferEventId: result.data.eventId,
        }));
      }
    }
    const thumbnailUrls = await signVehicleThumbnailReads(
      result.data.thumbnailPath ? [result.data.thumbnailPath] : [],
    );
    return mergeResponseHeaders(
      apiSuccess(
        {
          ...result.data.vehicle,
          thumbnailUrl: result.data.thumbnailPath
            ? thumbnailUrls.get(result.data.thumbnailPath) ?? null
            : null,
        },
        requestId,
        { meta: { idempotencyReplayed: result.replayed } },
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "vehicles.transfer");
  }
}

async function notifyTargetDriver(
  organizationId: string,
  targetUserId: string,
  eventId: string,
  vehicleId: string,
  unitNumber: string,
  note: string,
): Promise<void> {
  const tokens = await db
    .select({ token: mobilePushTokens.expoPushToken })
    .from(mobilePushTokens)
    .where(and(
      eq(mobilePushTokens.organizationId, organizationId),
      eq(mobilePushTokens.userId, targetUserId),
      eq(mobilePushTokens.isActive, true),
    ))
    .limit(20);
  const body = note ? `Unit ${unitNumber} is now assigned to you. ${note}` : `Unit ${unitNumber} is now assigned to you.`;
  const results = await Promise.all(tokens.map(async ({ token }) => ({
    result: await sendExpoPushNotification({
      body,
      data: { eventId, vehicleId },
      title: "Vehicle transferred",
      to: token,
    }),
    token,
  })));
  const invalidTokens = results
    .filter(({ result }) => result.permanentlyRejected)
    .map(({ token }) => token);
  if (invalidTokens.length > 0) {
    await db
      .update(mobilePushTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(mobilePushTokens.expoPushToken, invalidTokens));
  }
}
