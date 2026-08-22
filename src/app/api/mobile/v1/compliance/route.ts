import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { complianceDocuments, drivers, vehicles } from "@/lib/db/schema";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import { complianceQuerySchema, complianceWriteSchema } from "@/lib/mobile-api/contracts";
import { requireAdmin } from "@/lib/mobile-api/fleet-access";
import {
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
  parseStrictQuery,
} from "@/lib/mobile-api/http";

/**
 * Registration, inspection, insurance, CDL, and medical records.
 *
 * The subject is either a vehicle or a driver, so the row carries no foreign
 * key of its own; the subject is resolved inside this carrier before any write,
 * which is what keeps a document from being attached across a tenant boundary.
 */
export async function GET(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const query = parseStrictQuery(request, complianceQuerySchema, requestId);
  if (!query.success) return query.response;

  try {
    const carrierId = requireAdmin(principal);
    const filters = [eq(complianceDocuments.carrierId, carrierId)];
    if (query.data.subjectType) {
      filters.push(eq(complianceDocuments.subjectType, query.data.subjectType));
    }
    if (query.data.subjectId) {
      filters.push(eq(complianceDocuments.subjectId, query.data.subjectId));
    }

    const rows = await db
      .select()
      .from(complianceDocuments)
      .where(and(...filters))
      // Soonest expiry first: the register is a to-do list, not an archive.
      .orderBy(asc(complianceDocuments.expiresOn))
      .limit(query.data.limit);

    return mergeResponseHeaders(
      apiSuccess(rows.map(toComplianceDocument), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "compliance.list");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.compliance.write", limit: 30, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const { principal, requestId } = authorization;
  const body = await parseStrictJson(request, complianceWriteSchema, requestId);
  if (!body.success) return body.response;

  try {
    const carrierId = requireAdmin(principal);
    const subjectExists = body.data.subjectType === "vehicle"
      ? await db
          .select({ id: vehicles.id })
          .from(vehicles)
          .where(and(eq(vehicles.id, body.data.subjectId), eq(vehicles.carrierId, carrierId)))
          .limit(1)
      : await db
          .select({ id: drivers.id })
          .from(drivers)
          .where(and(eq(drivers.id, body.data.subjectId), eq(drivers.carrierId, carrierId)))
          .limit(1);
    if (subjectExists.length === 0) {
      throw new MobileApiError(
        404,
        "NOT_FOUND",
        `That ${body.data.subjectType} is not part of this carrier.`,
      );
    }

    const values = {
      carrierId,
      expiresOn: new Date(body.data.expiresOn),
      identifier: body.data.identifier,
      issuedOn: new Date(body.data.issuedOn),
      issuingState: body.data.issuingState,
      kind: body.data.kind,
      subjectId: body.data.subjectId,
      subjectType: body.data.subjectType,
      updatedAt: new Date(),
    };

    // One document of a given kind per subject: a second registration for the
    // same truck replaces the first rather than sitting beside it.
    const [row] = await db
      .insert(complianceDocuments)
      .values(values)
      .onConflictDoUpdate({
        set: values,
        target: [
          complianceDocuments.carrierId,
          complianceDocuments.subjectType,
          complianceDocuments.subjectId,
          complianceDocuments.kind,
        ],
      })
      .returning();

    return mergeResponseHeaders(
      apiSuccess(toComplianceDocument(row), requestId),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, requestId, "compliance.write");
  }
}

function toComplianceDocument(row: typeof complianceDocuments.$inferSelect) {
  return {
    expiresOn: row.expiresOn.toISOString(),
    id: row.id,
    identifier: row.identifier,
    issuedOn: row.issuedOn.toISOString(),
    issuingState: row.issuingState,
    kind: row.kind,
    subjectId: row.subjectId,
    subjectType: row.subjectType,
    updatedAt: row.updatedAt.toISOString(),
  };
}
