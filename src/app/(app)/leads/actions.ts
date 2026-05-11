"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, leads as leadsTable } from "@/lib/db/schema";
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

  // 1. Enroll each lead. Track outcomes for the result banner. Wrap each
  //    iteration so a DB failure on one lead doesn't poison the rest of
  //    the batch; collect failed IDs so the audit log captures them.
  const counts = {
    enrolled: 0,
    alreadyEnrolled: 0,
    suppressed: 0,
    noActiveStep: 0,
    noLead: 0,
    errored: 0,
  };
  const erroredIds: string[] = [];
  for (const leadId of parsed.leadIds) {
    try {
      const r = await enrollLeadInSequence(leadId, parsed.sequenceId);
      if (r.created) counts.enrolled++;
      else if (r.reason === "already_enrolled") counts.alreadyEnrolled++;
      else if (r.reason === "suppressed") counts.suppressed++;
      else if (r.reason === "no_active_step") counts.noActiveStep++;
      else if (r.reason === "no_lead") counts.noLead++;
    } catch (err) {
      counts.errored++;
      erroredIds.push(leadId);
      console.error(
        "[bulkSend] enrollment failed for",
        leadId,
        (err as Error).message,
      );
    }
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
      erroredIds: erroredIds.slice(0, 50),
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

/* ── Bulk archive (soft-delete) ─────────────────────────────────── */

/**
 * Soft-deletes the selected leads by setting archivedAt = now(). Rows
 * become invisible on /leads (which already filters archivedAt IS NULL)
 * but are recoverable via:
 *   UPDATE leads SET archived_at = NULL WHERE id IN (...);
 *
 * Idempotent — already-archived rows are no-ops. Returns counts via the
 * redirect URL so the operator sees what happened in the banner.
 */
const bulkArchiveSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
});

export async function bulkArchiveAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  env();

  const rawIds = formData.getAll("leadIds").map(String).filter(Boolean);
  const parsed = bulkArchiveSchema.parse({ leadIds: rawIds });

  let archived = 0;
  let errorMsg: string | null = null;

  try {
    const result = await db
      .update(leadsTable)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          inArray(leadsTable.id, parsed.leadIds),
          isNull(leadsTable.archivedAt),
        ),
      )
      .returning({ id: leadsTable.id });
    archived = result.length;

    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "leads",
      entityId: null,
      action: "bulk_archive",
      beforeJson: null,
      afterJson: {
        requested: parsed.leadIds.length,
        archived,
      },
      occurredAt: sql`now()`,
    });
  } catch (err) {
    errorMsg =
      (err as Error).name + ": " + (err as Error).message.slice(0, 120);
    console.error("[bulkArchive] FATAL:", err);
  }

  revalidatePath("/leads");

  const params = new URLSearchParams({
    archived_bulk: "1",
    archived: String(archived),
    requested: String(parsed.leadIds.length),
    stage: "all",
  });
  if (errorMsg) params.set("archive_error", errorMsg);
  redirect(`/leads?${params.toString()}`);
}
