import { env } from "@/lib/env";
import {
  defaultProviderFor,
  tickSequences,
} from "@/lib/sequences/tick";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * POST /api/cron/tick-sequences — runs the sequence engine once.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */

export async function POST(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;

  const report = await tickSequences({ providerFor: defaultProviderFor });
  return Response.json(report);
}

export async function GET(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;

  const report = await tickSequences({ providerFor: defaultProviderFor });
  return Response.json(report);
}
