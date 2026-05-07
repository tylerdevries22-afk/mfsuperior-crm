import { env } from "@/lib/env";
import {
  defaultProviderFor,
  tickSequences,
} from "@/lib/sequences/tick";

/**
 * POST /api/cron/tick-sequences — runs the sequence engine once.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sets this header
 * automatically when configured with the `crons` array in vercel.json).
 *
 * Vercel runs the schedule every 15 minutes. Local manual triggering: send
 * the same Bearer header from /admin's "Run tick now" button.
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();

  const report = await tickSequences({ providerFor: defaultProviderFor });
  return Response.json(report);
}

// Vercel Cron sends a GET on the cron schedule; mirror the behavior.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();

  const report = await tickSequences({ providerFor: defaultProviderFor });
  return Response.json(report);
}
