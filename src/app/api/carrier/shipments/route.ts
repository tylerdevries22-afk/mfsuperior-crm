import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, shipmentEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(shipments).orderBy(desc(shipments.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [row] = await db.insert(shipments).values(body).returning();
  return NextResponse.json(row, { status: 201 });
}
