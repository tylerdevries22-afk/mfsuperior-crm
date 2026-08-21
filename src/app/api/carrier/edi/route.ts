import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ediTransactions, shipments } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  parseQuery,
  requireCarrierAdmin,
  successResponse,
  withCarrierAuthHeaders,
} from "../_lib/http";
import {
  ediListQuerySchema,
  type EdiListQuery,
} from "../_lib/validation";

function searchPattern(query: string) {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

async function listTransactions(query: EdiListQuery, carrierId: string) {
  const filters: SQL[] = [eq(shipments.carrierId, carrierId)];
  if (query.direction) filters.push(eq(ediTransactions.direction, query.direction));
  if (query.status) filters.push(eq(ediTransactions.status, query.status));
  if (query.transactionType) {
    filters.push(eq(ediTransactions.transactionType, query.transactionType));
  }
  if (query.q) {
    const needle = searchPattern(query.q);
    const search = or(
      ilike(ediTransactions.controlNumber, needle),
      ilike(ediTransactions.senderId, needle),
      ilike(ediTransactions.receiverId, needle),
    );
    if (search) filters.push(search);
  }

  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.limit;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: ediTransactions.id,
        transactionType: ediTransactions.transactionType,
        direction: ediTransactions.direction,
        senderId: ediTransactions.senderId,
        receiverId: ediTransactions.receiverId,
        controlNumber: ediTransactions.controlNumber,
        shipmentId: ediTransactions.shipmentId,
        status: ediTransactions.status,
        createdAt: ediTransactions.createdAt,
      })
      .from(ediTransactions)
      .innerJoin(shipments, eq(ediTransactions.shipmentId, shipments.id))
      .where(where)
      .orderBy(desc(ediTransactions.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ediTransactions)
      .innerJoin(shipments, eq(ediTransactions.shipmentId, shipments.id))
      .where(where),
  ]);
  return { rows, total: Number(totalRow.count) };
}

export async function GET(request: Request) {
  const authorization = await requireCarrierAdmin(request);
  if (!authorization.authorized) return authorization.response;
  const query = parseQuery(
    request,
    ediListQuerySchema,
    authorization.requestId,
  );
  if (!query.success) return query.response;

  try {
    const { rows, total } = await listTransactions(
      query.data,
      authorization.principal.carrierId,
    );
    const safeRows = rows.map((row) => ({
      ...row,
      errorMessage:
        row.status === "error" ? "Processing error recorded" : null,
    }));
    return withCarrierAuthHeaders(
      successResponse(safeRows, authorization.requestId, {
        page: query.data.page,
        limit: query.data.limit,
        total,
        totalPages: Math.ceil(total / query.data.limit),
      }),
      authorization,
    );
  } catch (error) {
    return databaseErrorResponse(error, "edi.list", authorization.requestId);
  }
}
