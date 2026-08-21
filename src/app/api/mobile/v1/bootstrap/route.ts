import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  freightLocations,
  integrationConnections,
  organizations,
  drivers,
  users,
} from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
} from "@/lib/mobile-api/http";

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.bootstrap", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  try {
    const [[organization], [user], integrations, locations, driverRows] = await Promise.all([
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          status: organizations.status,
        })
        .from(organizations)
        .where(eq(organizations.id, principal.organizationId))
        .limit(1),
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, principal.userId))
        .limit(1),
      db
        .select({
          provider: integrationConnections.provider,
          status: integrationConnections.status,
          lastSucceededAt: integrationConnections.lastSucceededAt,
        })
        .from(integrationConnections)
        .where(eq(integrationConnections.organizationId, principal.organizationId))
        .orderBy(asc(integrationConnections.provider)),
      db
        .select({
          id: freightLocations.id,
          name: freightLocations.name,
          kind: freightLocations.kind,
          city: freightLocations.city,
          state: freightLocations.state,
          postalCode: freightLocations.postalCode,
        })
        .from(freightLocations)
        .where(eq(freightLocations.organizationId, principal.organizationId))
        .orderBy(asc(freightLocations.name))
        .limit(500),
      principal.role === "customer"
        ? Promise.resolve([])
        : db
            .select({
              id: drivers.id,
              firstName: drivers.firstName,
              lastName: drivers.lastName,
              email: drivers.email,
              phone: drivers.phone,
              licenseNumber: drivers.licenseNumber,
              licenseState: drivers.licenseState,
              status: drivers.status,
              currentLat: drivers.currentLat,
              currentLng: drivers.currentLng,
              locationUpdatedAt: drivers.locationUpdatedAt,
            })
            .from(drivers)
            .where(
              and(
                eq(drivers.carrierId, principal.carrierId ?? "00000000-0000-0000-0000-000000000000"),
                ...(principal.role === "driver" && principal.driverId
                  ? [eq(drivers.id, principal.driverId)]
                  : []),
              ),
            )
            .orderBy(asc(drivers.lastName), asc(drivers.firstName))
            .limit(500),
    ]);
    if (!organization) {
      return apiFailureResponse(
        new Error("Authorized organization disappeared"),
        requestId,
        "bootstrap.organization",
      );
    }
    return mergeResponseHeaders(
      apiSuccess(
        {
          user: {
            id: principal.userId,
            email: principal.email,
            displayName: user?.name ?? principal.email.split("@")[0],
            role: principal.role,
            driverId: principal.driverId,
            customerAccountId: principal.customerAccountId,
          },
          organization,
          carrierId: principal.carrierId,
          capabilities: {
            manageOperations: principal.role === "admin",
            updateAssignedShipments:
              principal.role === "admin" || principal.role === "driver",
            submitFreightRequests:
              principal.role === "admin" || principal.role === "customer",
          },
          referenceData: { drivers: driverRows, locations },
          integrations,
        },
        requestId,
      ),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "bootstrap.read");
  }
}
