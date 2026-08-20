import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ediTransactions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(ediTransactions).orderBy(desc(ediTransactions.createdAt));
  return NextResponse.json(rows);
}
