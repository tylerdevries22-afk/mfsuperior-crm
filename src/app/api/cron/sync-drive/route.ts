import { env } from "@/lib/env";
import { syncDrive } from "@/lib/sequences/sync-drive";
import { checkCronAuth } from "@/lib/cron-auth";

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
