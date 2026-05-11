import { env } from "@/lib/env";
import { syncDrive } from "@/lib/sequences/sync-drive";
import { checkCronAuth } from "@/lib/cron-auth";

// Drive sync downloads + parses an xlsx and reconciles with the leads
// table. 60s is plenty for the expected workload (~1k rows); Hobby caps
// at 10s anyway.
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;
  const report = await syncDrive();
  return Response.json(report);
}

export async function GET(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;
  const report = await syncDrive();
  return Response.json(report);
}
