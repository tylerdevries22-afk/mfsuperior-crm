import { and, eq, sql, type SQL } from "drizzle-orm";
import {
  driverAvailabilityBlocks,
  driverAvailabilityRules,
  driverPayouts,
  vehicles,
} from "@/lib/db/schema";
import type { MobilePrincipal } from "./authorize";
import { MobileApiError } from "./http";

/**
 * Tenant and role scoping for the fleet, availability, shop, compliance, and
 * settlement endpoints.
 *
 * Every predicate pins the carrier first. Role narrowing happens on top of that
 * pin, never instead of it, so a bug in the role branch can still only ever
 * widen a read inside one carrier.
 */

/** The carrier this principal belongs to, or a 403 if they have none. */
export function requireCarrierId(principal: MobilePrincipal): string {
  if (!principal.carrierId) {
    throw new MobileApiError(403, "TENANT_ACCESS_DENIED", "This account is not linked to a carrier.");
  }
  return principal.carrierId;
}

/** Admin-only endpoints: fleet, shop, compliance, settlement issuance. */
export function requireAdmin(principal: MobilePrincipal): string {
  if (principal.role !== "admin") {
    throw new MobileApiError(403, "ROLE_REQUIRED", "An admin role is required for this operation.");
  }
  return requireCarrierId(principal);
}

/** Driver-only endpoints: payout handles. */
export function requireDriverId(principal: MobilePrincipal): string {
  if (principal.role !== "driver" || !principal.driverId) {
    throw new MobileApiError(403, "ROLE_REQUIRED", "A driver role is required for this operation.");
  }
  return principal.driverId;
}

/**
 * Whose calendar this principal may write.
 *
 * An admin may name any driver inside their carrier. A driver may only write
 * their own, and naming somebody else is refused rather than redirected — a
 * client that sent the wrong id should fail loudly, not silently edit the
 * wrong person's schedule.
 */
export function resolveAvailabilityDriverId(
  principal: MobilePrincipal,
  requestedDriverId: string | null | undefined,
): string {
  if (principal.role === "admin") {
    if (!requestedDriverId) {
      throw new MobileApiError(400, "VALIDATION_ERROR", "Name the driver whose calendar this is.");
    }
    return requestedDriverId;
  }

  const driverId = requireDriverId(principal);
  if (requestedDriverId && requestedDriverId !== driverId) {
    throw new MobileApiError(
      403,
      "ROLE_REQUIRED",
      "A driver can only change their own availability.",
    );
  }
  return driverId;
}

/** Availability reads: admins see the carrier, drivers see themselves. */
export function availabilityBlockAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(driverAvailabilityBlocks.carrierId, principal.carrierId);
  if (principal.role === "admin") return tenant;
  if (principal.role === "driver" && principal.driverId) {
    return and(tenant, eq(driverAvailabilityBlocks.driverId, principal.driverId)) ?? sql`false`;
  }
  return sql`false`;
}

export function availabilityRuleAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(driverAvailabilityRules.carrierId, principal.carrierId);
  if (principal.role === "admin") return tenant;
  if (principal.role === "driver" && principal.driverId) {
    return and(tenant, eq(driverAvailabilityRules.driverId, principal.driverId)) ?? sql`false`;
  }
  return sql`false`;
}

/**
 * Settlement reads. A driver sees their own ledger; an admin sees the carrier's.
 * Note this governs the payout record, which names a rail but never a handle.
 */
export function payoutAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(driverPayouts.carrierId, principal.carrierId);
  if (principal.role === "admin") return tenant;
  if (principal.role === "driver" && principal.driverId) {
    return and(tenant, eq(driverPayouts.driverId, principal.driverId)) ?? sql`false`;
  }
  return sql`false`;
}

/** Fleet reads are carrier-wide and admin-only. */
export function vehicleAccessPredicate(principal: MobilePrincipal): SQL {
  if (principal.role !== "admin" || !principal.carrierId) return sql`false`;
  return eq(vehicles.carrierId, principal.carrierId);
}
