import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, drivers } from "@/lib/db/schema";
import { sql, and, gte, eq } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [activeShipmentsRow] = await db.select({ count: sql<number>`count(*)` }).from(shipments).where(sql`${shipments.status} not in ('delivered','cancelled')`);
  const [todayDeliveriesRow] = await db.select({ count: sql<number>`count(*)` }).from(shipments).where(and(eq(shipments.status, 'delivered'), gte(shipments.deliveredAt, todayStart)));
  const [activeDriversRow] = await db.select({ count: sql<number>`count(*)` }).from(drivers).where(eq(drivers.status, 'on_duty'));
  const [pendingTendersRow] = await db.select({ count: sql<number>`count(*)` }).from(shipments).where(eq(shipments.status, 'tendered'));

  return NextResponse.json({
    activeShipments: Number(activeShipmentsRow.count),
    todayDeliveries: Number(todayDeliveriesRow.count),
    onTimeRate: 0,
    avgTransitHours: 0,
    activeDrivers: Number(activeDriversRow.count),
    pendingTenders: Number(pendingTendersRow.count),
  });
}
