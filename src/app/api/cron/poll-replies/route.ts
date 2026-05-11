import { env } from "@/lib/env";
import {
  defaultPollProviderFor,
  pollInbox,
} from "@/lib/sequences/poll-inbox";
import { checkCronAuth } from "@/lib/cron-auth";

// Pro plan gets 60s to fetch threads and process replies; Hobby caps at 10s.
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;
  const report = await pollInbox({ providerFor: defaultPollProviderFor });
  return Response.json(report);
}

export async function GET(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;
  const report = await pollInbox({ providerFor: defaultPollProviderFor });
  return Response.json(report);
}
