import { env } from "@/lib/env";
import { syncDrive } from "@/lib/sequences/sync-drive";

/**
 * POST/GET /api/cron/sync-drive — runs the Drive lead-list sync once.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sets this header
 * automatically when configured via vercel.json (hourly schedule).
 *
 * Pull-only for v1: new sheet rows are inserted, existing matches are
 * confirmed (lastSyncedAt is touched), and rows missing from the sheet are
 * flagged as orphans (never deleted). Push-back (CRM → sheet) is out of
 * scope until we have hash-based change detection.
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();
  const report = await syncDrive();
  return Response.json(report);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();
  const report = await syncDrive();
  return Response.json(report);
}
