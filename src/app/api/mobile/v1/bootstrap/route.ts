import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  freightLocations,
  integrationConnections,
  organizationMemberships,
  organizations,
  drivers,
  users,
} from "@/lib/db/schema";
import {
  authorizeMobileRequest,
  type MobilePrincipal,
} from "@/lib/mobile-api/authorize";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
} from "@/lib/mobile-api/http";

/**
 * The messaging directory. Admins see the whole active roster; drivers and
 * customers only see the operations admins they are allowed to message.
 */
function contactRolesFor(principal: MobilePrincipal) {
  return principal.role === "admin"
    ? (["admin", "driver", "customer"] as const)
    : (["admin"] as const);
}

function loadContacts(principal: MobilePrincipal) {
  return db
    .select({
      id: users.id,
      displayName: users.name,
      email: users.email,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .where(
      and(
        eq(organizationMemberships.organizationId, principal.organizationId),
        eq(organizationMemberships.status, "active"),
        inArray(organizationMemberships.role, [...contactRolesFor(principal)]),
      ),
    )
    .orderBy(asc(organizationMemberships.role), asc(users.email))
    .limit(200);
}

export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.bootstrap", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;

  try {
    const [
      [organization],
      [user],
      integrations,
      locations,
      driverRows,
      contacts,
    ] = await Promise.all([
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
      principal.role === "admin"
        ? db
            .select({
              provider: integrationConnections.provider,
              status: integrationConnections.status,
              lastSucceededAt: integrationConnections.lastSucceededAt,
            })
            .from(integrationConnections)
            .where(eq(integrationConnections.organizationId, principal.organizationId))
            .orderBy(asc(integrationConnections.provider))
        : Promise.resolve([]),
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
      loadContacts(principal),
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
          referenceData: {
            contacts: contacts.map((contact) => ({
              id: contact.id,
              displayName: contact.displayName ?? contact.email.split("@")[0],
              email: contact.email,
              role: contact.role,
            })),
            drivers: driverRows,
            locations,
          },
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
