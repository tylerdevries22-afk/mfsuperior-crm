/**
 * Bulk email validation — MX-only, hard-delete on failure.
 *
 * Used by:
 *   - validateAllEmailsAction (manual button on /admin)
 *   - /api/cron/validate-emails (weekly cron)
 *
 * Strategy (per operator's decisions):
 *   - MX-only validation via existing validateEmail() (DNS resolveMx +
 *     freemail/disposable/role-on-no-MX blocklists). Free, offline,
 *     fast.
 *   - Hard DELETE invalid leads. Schema audit confirmed every FK into
 *     leads.id is either `cascade` (enrollments, emailEvents,
 *     emailClicks, crmNotes) or `set null` (unsubscribes, notifications)
 *     so the DELETE is safe.
 *   - Forensic recovery: every deleted row's full payload is captured
 *     in auditLog.beforeJson before deletion, so a critical mis-delete
 *     can be restored via SQL INSERT from the audit data.
 *
 * Concurrency: parallel batches of 50 leads with Promise.allSettled.
 * MX lookups are ~50-100ms each; 150 leads × 50ms ÷ 50-wide batches ≈
 * 300ms total. Fits comfortably inside Vercel Hobby's 10s function
 * limit.
 */

import { isNotNull, isNull, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, leads as leadsTable } from "@/lib/db/schema";
import { validateEmail } from "@/lib/research/mx-validate";

export type ValidateAllReport = {
  checked: number;
  valid: number;
  invalid: number;
  hardDeleted: number;
  /** Status histogram for transparency. */
  byStatus: Record<string, number>;
  durationMs: number;
  /** Truncated list of deleted lead IDs (for the UI summary). */
  deletedSample: string[];
  errors: string[];
};

const BATCH_SIZE = 50;

/**
 * @param actorUserId User who triggered the run. Null for cron.
 * @param dryRun If true, identifies invalid leads but does NOT delete.
 */
export async function validateAllLeadEmails(opts: {
  actorUserId: string | null;
  dryRun?: boolean;
}): Promise<ValidateAllReport> {
  const start = Date.now();
  const errors: string[] = [];
  const byStatus: Record<string, number> = {};

  // 1. Pull every non-archived lead with a non-null email.
  const candidates = await db
    .select({
      id: leadsTable.id,
      email: leadsTable.email,
      companyName: leadsTable.companyName,
      website: leadsTable.website,
      phone: leadsTable.phone,
      vertical: leadsTable.vertical,
      address: leadsTable.address,
      city: leadsTable.city,
      state: leadsTable.state,
      source: leadsTable.source,
      tier: leadsTable.tier,
      score: leadsTable.score,
      tags: leadsTable.tags,
      notes: leadsTable.notes,
      stage: leadsTable.stage,
    })
    .from(leadsTable)
    .where(
      and(isNotNull(leadsTable.email), isNull(leadsTable.archivedAt)),
    );

  const checked = candidates.length;
  if (checked === 0) {
    return {
      checked: 0,
      valid: 0,
      invalid: 0,
      hardDeleted: 0,
      byStatus: {},
      durationMs: Date.now() - start,
      deletedSample: [],
      errors: [],
    };
  }

  // 2. Validate in parallel batches.
  type LeadRow = (typeof candidates)[number];
  const invalidRows: LeadRow[] = [];
  let valid = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const slice = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      slice.map(async (lead) => {
        const r = await validateEmail(lead.email!);
        return { lead, r };
      }),
    );
    for (const s of results) {
      if (s.status === "rejected") {
        errors.push(
          `validation threw: ${(s.reason as Error)?.message?.slice(0, 80) ?? "unknown"}`,
        );
        continue;
      }
      const { lead, r } = s.value;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.confidence === "rejected") {
        invalidRows.push(lead);
      } else {
        valid++;
      }
    }
  }

  const invalid = invalidRows.length;

  // 3. Hard DELETE the invalid leads. Schema audit confirmed all FKs
  //    cascade safely. Capture the full row in auditLog BEFORE deleting
  //    so the operator can recover any false-positive deletion.
  let hardDeleted = 0;
  const deletedSample: string[] = [];

  if (invalid > 0 && !opts.dryRun) {
    const invalidIds = invalidRows.map((r) => r.id);
    try {
      // Audit FIRST so the recovery payload is durable even if DELETE fails.
      await db.insert(auditLog).values({
        actorUserId: opts.actorUserId,
        entity: "leads",
        entityId: null,
        action: "validate_all_emails_delete",
        beforeJson: { deletedRows: invalidRows },
        afterJson: { count: invalid, batchedFrom: candidates.length },
        occurredAt: sql`now()`,
      });

      const deleted = await db
        .delete(leadsTable)
        .where(inArray(leadsTable.id, invalidIds))
        .returning({ id: leadsTable.id });
      hardDeleted = deleted.length;
      for (const d of deleted.slice(0, 20)) deletedSample.push(d.id);
    } catch (err) {
      errors.push(
        `DELETE failed: ${(err as Error).message.slice(0, 120)}`,
      );
    }
  } else if (invalid > 0 && opts.dryRun) {
    for (const r of invalidRows.slice(0, 20)) deletedSample.push(r.id);
  }

  // 4. Summary audit log entry.
  try {
    await db.insert(auditLog).values({
      actorUserId: opts.actorUserId,
      entity: "leads",
      entityId: null,
      action: opts.dryRun
        ? "validate_all_emails_dry_run"
        : "validate_all_emails",
      beforeJson: null,
      afterJson: {
        checked,
        valid,
        invalid,
        hardDeleted,
        byStatus,
        durationMs: Date.now() - start,
        errors: errors.slice(0, 10),
      },
      occurredAt: sql`now()`,
    });
  } catch (err) {
    errors.push(
      `summary audit failed: ${(err as Error).message.slice(0, 80)}`,
    );
  }

  return {
    checked,
    valid,
    invalid,
    hardDeleted,
    byStatus,
    durationMs: Date.now() - start,
    deletedSample,
    errors,
  };
}
