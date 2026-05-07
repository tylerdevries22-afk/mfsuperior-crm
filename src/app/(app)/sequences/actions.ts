"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  auditLog,
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  suppressionList,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";

/* ─── Enroll a single lead ──────────────────────────────────── */

const enrollOneSchema = z.object({
  leadId: z.string().uuid(),
  sequenceId: z.string().uuid(),
});

export async function enrollLeadAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { leadId, sequenceId } = enrollOneSchema.parse({
    leadId: formData.get("leadId"),
    sequenceId: formData.get("sequenceId"),
  });

  const result = await enrollLeadInternal(leadId, sequenceId, session.user.id);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "enrollment",
    entityId: result.enrollmentId ?? null,
    action: result.created ? "enroll" : "enroll_skip",
    beforeJson: null,
    afterJson: { reason: result.reason ?? null, sequenceId, leadId },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/sequences/${sequenceId}`);
  redirect(
    `/leads/${leadId}?enroll_${result.created ? "ok" : "skip"}=${encodeURIComponent(result.reason ?? "ok")}`,
  );
}

/* ─── Enroll by filter (sequence detail page) ───────────────── */

const enrollByFilterSchema = z.object({
  sequenceId: z.string().uuid(),
  tier: z.enum(["A", "B", "C", ""]).optional(),
  stage: z
    .enum(["new", "contacted", "replied", "quoted", "won", "lost", ""])
    .optional(),
  q: z.string().max(120).optional().or(z.literal("")),
  hasEmailOnly: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ).default(true),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export async function enrollByFilterAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = enrollByFilterSchema.parse({
    sequenceId: formData.get("sequenceId"),
    tier: formData.get("tier") ?? "",
    stage: formData.get("stage") ?? "",
    q: formData.get("q") ?? "",
    hasEmailOnly: formData.get("hasEmailOnly"),
    limit: formData.get("limit") ?? 50,
  });

  const filters: SQL[] = [isNull(leads.archivedAt)];
  if (parsed.tier) filters.push(eq(leads.tier, parsed.tier));
  if (parsed.stage) filters.push(eq(leads.stage, parsed.stage));
  if (parsed.q) {
    filters.push(
      or(
        ilike(leads.companyName, `%${parsed.q}%`),
        ilike(leads.email, `%${parsed.q}%`),
        ilike(leads.city, `%${parsed.q}%`),
        ilike(leads.vertical, `%${parsed.q}%`),
      ) as SQL,
    );
  }
  // hasEmailOnly is the safe default — the kit's leads have no emails
  // captured yet, so an "include email-less" path lets the user enroll
  // them anyway (drafts will block at compose time without an email).
  if (parsed.hasEmailOnly) {
    filters.push(sql`${leads.email} IS NOT NULL`);
  }
  const where = filters.length === 1 ? filters[0] : and(...filters);

  const candidates = await db
    .select({ id: leads.id })
    .from(leads)
    .where(where)
    .orderBy(asc(leads.companyName))
    .limit(parsed.limit);

  let created = 0;
  let skipped = 0;
  for (const c of candidates) {
    const r = await enrollLeadInternal(c.id, parsed.sequenceId, session.user.id);
    if (r.created) created++;
    else skipped++;
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "enrollments",
    entityId: parsed.sequenceId,
    action: "enroll_by_filter",
    beforeJson: null,
    afterJson: {
      sequenceId: parsed.sequenceId,
      tier: parsed.tier,
      stage: parsed.stage,
      q: parsed.q,
      hasEmailOnly: parsed.hasEmailOnly,
      candidates: candidates.length,
      created,
      skipped,
    },
  });

  revalidatePath(`/sequences/${parsed.sequenceId}`);
  redirect(
    `/sequences/${parsed.sequenceId}?bulk_enrolled=${created}&bulk_skipped=${skipped}&bulk_candidates=${candidates.length}`,
  );
}

/* ─── Internal: idempotent enroll ───────────────────────────── */

type EnrollResult = {
  created: boolean;
  enrollmentId: string | null;
  reason?: "already_enrolled" | "suppressed" | "no_active_step" | "ok";
};

async function enrollLeadInternal(
  leadId: string,
  sequenceId: string,
  _actorUserId: string,
): Promise<EnrollResult> {
  // Look up the lead (we need email for suppression check).
  const [lead] = await db
    .select({ id: leads.id, email: leads.email })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return { created: false, enrollmentId: null, reason: "ok" };

  // Suppression: never enroll a suppressed email.
  if (lead.email) {
    const [supp] = await db
      .select({ email: suppressionList.email })
      .from(suppressionList)
      .where(eq(suppressionList.email, lead.email))
      .limit(1);
    if (supp) {
      return { created: false, enrollmentId: null, reason: "suppressed" };
    }
  }

  // Find the lowest active step's template.
  const [firstTemplate] = await db
    .select({ step: emailTemplates.sequenceStep })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.sequenceId, sequenceId),
        eq(emailTemplates.isActive, true),
      ),
    )
    .orderBy(asc(emailTemplates.sequenceStep))
    .limit(1);
  if (firstTemplate?.step == null) {
    return { created: false, enrollmentId: null, reason: "no_active_step" };
  }

  // Idempotent insert: the unique index on (lead_id, sequence_id) catches dupes.
  const [inserted] = await db
    .insert(leadSequenceEnrollments)
    .values({
      leadId,
      sequenceId,
      currentStep: firstTemplate.step,
      status: "active",
      // Send the first message on the next tick (we don't honor delay_days for step 1).
      nextSendAt: sql`now()`,
    })
    .onConflictDoNothing()
    .returning({ id: leadSequenceEnrollments.id });

  if (!inserted) {
    return { created: false, enrollmentId: null, reason: "already_enrolled" };
  }
  return { created: true, enrollmentId: inserted.id, reason: "ok" };
}
