import { env } from "@/lib/env";
import { validateAllLeadEmails } from "@/lib/email/validate-bulk";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * GET/POST /api/cron/validate-emails — runs the bulk email validator.
 * Hard-deletes leads whose domain MX records fail (per operator decision).
 *
 * Schedule: every Monday 2am UTC via .github/workflows/cron-validate-emails.yml
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */

// 60s on Pro; capped at 10s on Hobby. Bulk validator runs ~300ms over
// ~200 leads, so this is comfortable headroom.
export const maxDuration = 60;

async function run(request: Request) {
  const unauth = checkCronAuth(request, env().CRON_SECRET);
  if (unauth) return unauth;

  const report = await validateAllLeadEmails({ actorUserId: null });
  return Response.json(report);
}

export const GET = run;
export const POST = run;
