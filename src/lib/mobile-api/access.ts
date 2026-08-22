import { and, eq, exists, or, sql, type SQL } from "drizzle-orm";
import {
  customerShipmentAccess,
  freightDocuments,
  freightRequests,
  operationsMessages,
  shipments,
} from "@/lib/db/schema";
import type { MobilePrincipal } from "./authorize";

/** Database predicate used by every mobile shipment read/update. */
export function shipmentAccessPredicate(principal: MobilePrincipal): SQL {
  if (!principal.carrierId) return sql`false`;
  const tenant = eq(shipments.carrierId, principal.carrierId);
  if (principal.role === "admin") return tenant;
  if (principal.role === "driver" && principal.driverId) {
    return and(tenant, eq(shipments.driverId, principal.driverId)) ?? sql`false`;
  }
  if (principal.role === "customer" && principal.customerAccountId) {
    return and(
      tenant,
      exists(
        dbCustomerShipmentAccess(principal.organizationId, principal.customerAccountId),
      ),
    ) ?? sql`false`;
  }
  return sql`false`;
}

function dbCustomerShipmentAccess(
  organizationId: string,
  customerAccountId: string,
) {
  return sql`select 1 from ${customerShipmentAccess}
    where ${customerShipmentAccess.organizationId} = ${organizationId}
      and ${customerShipmentAccess.customerAccountId} = ${customerAccountId}
      and ${customerShipmentAccess.shipmentId} = ${shipments.id}`;
}

/** Database predicate used by every request read. */
export function freightRequestAccessPredicate(principal: MobilePrincipal): SQL {
  const tenant = eq(freightRequests.organizationId, principal.organizationId);
  if (principal.role === "admin") return tenant;
  if (
    principal.role === "customer" &&
    principal.membershipStatus === "pending"
  ) {
    return and(
      tenant,
      eq(freightRequests.createdByUserId, principal.userId),
    ) ?? sql`false`;
  }
  if (principal.role === "customer" && principal.customerAccountId) {
    return and(
      tenant,
      eq(freightRequests.customerAccountId, principal.customerAccountId),
    ) ?? sql`false`;
  }
  return sql`false`;
}

/** Documents inherit access from their linked shipment or freight request. */
export function documentAccessPredicate(principal: MobilePrincipal): SQL {
  const tenant = eq(freightDocuments.organizationId, principal.organizationId);
  if (principal.role === "admin") return tenant;
  if (principal.role === "driver" && principal.driverId && principal.carrierId) {
    return and(
      tenant,
      exists(sql`select 1 from ${shipments}
        where ${shipments.id} = ${freightDocuments.shipmentId}
          and ${shipments.carrierId} = ${principal.carrierId}
          and ${shipments.driverId} = ${principal.driverId}`),
    ) ?? sql`false`;
  }
  if (principal.role === "customer" && principal.customerAccountId) {
    return and(
      tenant,
      sql`(
        exists(select 1 from ${customerShipmentAccess}
          where ${customerShipmentAccess.organizationId} = ${principal.organizationId}
            and ${customerShipmentAccess.customerAccountId} = ${principal.customerAccountId}
            and ${customerShipmentAccess.shipmentId} = ${freightDocuments.shipmentId})
        or exists(select 1 from ${freightRequests}
          where ${freightRequests.id} = ${freightDocuments.requestId}
            and ${freightRequests.organizationId} = ${principal.organizationId}
            and ${freightRequests.customerAccountId} = ${principal.customerAccountId})
      )`,
    ) ?? sql`false`;
  }
  return sql`false`;
}

/**
 * A message is readable by its sender and by any listed recipient inside the
 * same organization. Admins never gain a blanket read over private threads.
 */
export function operationsMessageAccessPredicate(
  principal: MobilePrincipal,
): SQL {
  if (principal.membershipStatus !== "active") return sql`false`;
  return and(
    eq(operationsMessages.organizationId, principal.organizationId),
    or(
      eq(operationsMessages.senderUserId, principal.userId),
      sql`${operationsMessages.recipientUserIds} @> ${JSON.stringify([principal.userId])}::jsonb`,
    ),
  ) ?? sql`false`;
}
