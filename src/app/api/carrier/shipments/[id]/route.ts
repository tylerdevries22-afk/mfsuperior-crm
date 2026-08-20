import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, shipmentEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, params.id));
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = await db.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, params.id)).orderBy(desc(shipmentEvents.recordedAt));
  return NextResponse.json({ ...shipment, events });
}
