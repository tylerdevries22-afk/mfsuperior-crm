"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { enrollLeadInSequence } from "@/lib/sequences/enroll";
import { defaultProviderFor, tickSequences } from "@/lib/sequences/tick";

/**
 * Bulk-enroll the selected leads in a sequence and immediately fire the
 * tick so the first email goes out now (instead of waiting for the 15-min
 * cron). Idempotent — re-running on the same lead/sequence is a no-op.
 *
 * Pipeline integration:
 *  1. enrollLeadInSequence(leadId, sequenceId) per lead
 *      - skips suppressed addresses
 *      - skips already-enrolled
 *      - sets nextSendAt = now() so the next tick picks them up
 *  2. tickSequences()
 *      - composes with personalization, compliance footer, unsubscribe
 *        link, open-tracking pixel, click-tracking rewrites
 *      - sends via the connected user's Gmail (or Resend if templates
 *        are configured for it)
 *      - on auto_send: lead.stage advances new -> contacted, the lead
 *        drops off /leads and the conversation surfaces in /inbox
 *      - emits sent / drafted / failed rows into emailEvents
 *      - honors the daily cap and warmup pacing from /settings
 */

const bulkSendSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  sequenceId: z.string().uuid(),
});

export async function bulkSendAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Touch env so misconfigured deployments fail loudly here.
  env();

  const rawIds = formData.getAll("leadIds").map(String).filter(Boolean);
  const parsed = bulkSendSchema.parse({
    leadIds: rawIds,
    sequenceId: formData.get("sequenceId"),
  });

  // 1. Enroll each lead. Track outcomes for the result banner.
  const counts = {
    enrolled: 0,
    alreadyEnrolled: 0,
    suppressed: 0,
    noActiveStep: 0,
    noLead: 0,
  };
  for (const leadId of parsed.leadIds) {
    const r = await enrollLeadInSequence(leadId, parsed.sequenceId);
    if (r.created) counts.enrolled++;
    else if (r.reason === "already_enrolled") counts.alreadyEnrolled++;
    else if (r.reason === "suppressed") counts.suppressed++;
    else if (r.reason === "no_active_step") counts.noActiveStep++;
    else if (r.reason === "no_lead") counts.noLead++;
  }

  // 2. Fire the tick now so freshly-enrolled leads send in this request,
  //    not 15 minutes from now. Already-enrolled leads whose nextSendAt is
  //    in the future are unaffected.
  const tick = await tickSequences({ providerFor: defaultProviderFor });

  // 3. Audit.
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "leads",
    entityId: parsed.sequenceId,
    action: "bulk_send",
    beforeJson: null,
    afterJson: {
      sequenceId: parsed.sequenceId,
      requested: parsed.leadIds.length,
      ...counts,
      tick: {
        due: tick.due,
        sent: tick.sent,
        drafted: tick.drafted,
        paused: tick.paused,
        failed: tick.failed,
        skippedSuppressed: tick.skippedSuppressed,
        skippedNoEmail: tick.skippedNoEmail,
        skippedCapped: tick.skippedCapped,
      },
    },
  });

  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath(`/sequences/${parsed.sequenceId}`);

  const params = new URLSearchParams({
    sent: "1",
    requested: String(parsed.leadIds.length),
    enrolled: String(counts.enrolled),
    already: String(counts.alreadyEnrolled),
    suppressed: String(counts.suppressed),
    no_step: String(counts.noActiveStep),
    no_lead: String(counts.noLead),
    tick_sent: String(tick.sent),
    tick_drafted: String(tick.drafted),
    tick_failed: String(tick.failed),
    tick_capped: String(tick.skippedCapped),
    tick_no_email: String(tick.skippedNoEmail),
    tick_notes: tick.notes.length
      ? encodeURIComponent(tick.notes.join("|"))
      : "",
  });
  redirect(`/leads?${params.toString()}`);
}
