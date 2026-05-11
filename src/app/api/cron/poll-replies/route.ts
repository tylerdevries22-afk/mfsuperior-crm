import { env } from "@/lib/env";
import {
  defaultPollProviderFor,
  pollInbox,
} from "@/lib/sequences/poll-inbox";
import { checkCronAuth } from "@/lib/cron-auth";

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
