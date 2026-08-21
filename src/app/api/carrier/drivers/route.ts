import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers } from "@/lib/db/schema";
import {
  databaseErrorResponse,
  parseJsonBody,
  parseQuery,
  requireCarrierDispatcher,
  successResponse,
} from "../_lib/http";
import {
  driverCreateSchema,
  driverListQuerySchema,
  type DriverListQuery,
} from "../_lib/validation";

function searchPattern(query: string) {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

async function listDrivers(query: DriverListQuery) {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(drivers.status, query.status));
  if (query.q) {
    const needle = searchPattern(query.q);
    const search = or(
      ilike(drivers.firstName, needle),
      ilike(drivers.lastName, needle),
      ilike(drivers.email, needle),
      ilike(drivers.phone, needle),
    );
    if (search) filters.push(search);
  }

  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.limit;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: drivers.id,
        carrierId: drivers.carrierId,
        firstName: drivers.firstName,
        lastName: drivers.lastName,
        email: drivers.email,
        phone: drivers.phone,
        status: drivers.status,
        currentLat: drivers.currentLat,
        currentLng: drivers.currentLng,
        locationUpdatedAt: drivers.locationUpdatedAt,
        licenseState: drivers.licenseState,
        cdlType: drivers.cdlType,
        createdAt: drivers.createdAt,
      })
      .from(drivers)
      .where(where)
      .orderBy(desc(drivers.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(drivers)
      .where(where),
  ]);
  return { rows, total: Number(totalRow.count) };
}

export async function GET(request: Request) {
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const query = parseQuery(request, driverListQuerySchema);
  if (!query.success) return query.response;

  try {
    const { rows, total } = await listDrivers(query.data);
    return successResponse(rows, {
      page: query.data.page,
      limit: query.data.limit,
      total,
      totalPages: Math.ceil(total / query.data.limit),
    });
  } catch (error) {
    return databaseErrorResponse(error, "drivers.list");
  }
}

export async function POST(request: Request) {
  const authorization = await requireCarrierDispatcher();
  if (!authorization.authorized) return authorization.response;
  const body = await parseJsonBody(request, driverCreateSchema);
  if (!body.success) return body.response;

  try {
    const [driver] = await db.insert(drivers).values(body.data).returning();
    return successResponse(driver, null, 201);
  } catch (error) {
    return databaseErrorResponse(error, "drivers.create");
  }
}
