import { env } from "@/lib/env";
import {
  defaultPollProviderFor,
  pollInbox,
} from "@/lib/sequences/poll-inbox";

/**
 * POST/GET /api/cron/poll-replies — runs the inbox poller once.
 *
 * Detects both replies (any inbound thread message that isn't us) and
 * bounces (Mailer-Daemon / Postmaster / common DSN sender patterns).
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sets this header
 * automatically when configured via vercel.json.
 *
 * Schedule: every 5 minutes (configured in vercel.json).
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();
  const report = await pollInbox({ providerFor: defaultPollProviderFor });
  return Response.json(report);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();
  const report = await pollInbox({ providerFor: defaultPollProviderFor });
  return Response.json(report);
}
