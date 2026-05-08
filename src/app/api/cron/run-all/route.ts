import { env } from "@/lib/env";
import { defaultProviderFor, tickSequences } from "@/lib/sequences/tick";
import { defaultPollProviderFor, pollInbox } from "@/lib/sequences/poll-inbox";
import { syncDrive } from "@/lib/sequences/sync-drive";

/**
 * GET/POST /api/cron/run-all
 *
 * Single unified cron handler for Vercel Hobby plan (one job per day limit).
 * Runs tick-sequences, poll-replies, and sync-drive sequentially.
 * Each step is allowed to fail independently; errors are captured in the report.
 *
 * Upgrade to Vercel Pro to use the individual /api/cron/* endpoints with
 * their intended schedules (every-15-min, every-5-min, hourly).
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

async function run(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env().CRON_SECRET}`) return unauthorized();

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
