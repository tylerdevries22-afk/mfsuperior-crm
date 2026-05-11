import { env } from "@/lib/env";
import { defaultProviderFor, tickSequences } from "@/lib/sequences/tick";
import { defaultPollProviderFor, pollInbox } from "@/lib/sequences/poll-inbox";
import { syncDrive } from "@/lib/sequences/sync-drive";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * GET/POST /api/cron/run-all — unified handler that runs tick + poll + sync.
 */

async function run(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;

  const results: Record<string, unknown> = {};

  try {
    results.tick = await tickSequences({ providerFor: defaultProviderFor });
  } catch (e) {
    results.tick = { error: String(e) };
  }

  try {
    results.pollReplies = await pollInbox({ providerFor: defaultPollProviderFor });
  } catch (e) {
    results.pollReplies = { error: String(e) };
  }

  try {
    results.syncDrive = await syncDrive();
  } catch (e) {
    results.syncDrive = { error: String(e) };
  }

  return Response.json({ ok: true, ...results });
}

export const GET = run;
export const POST = run;
