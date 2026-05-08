import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  suppressionList,
} from "@/lib/db/schema";

export type EnrollResult = {
  created: boolean;
  enrollmentId: string | null;
  reason: "already_enrolled" | "suppressed" | "no_active_step" | "no_lead" | "ok";
};

/**
 * Idempotent enroll: looks up the lead, refuses suppressed addresses, finds
 * the lowest active step's template, and inserts a `leadSequenceEnrollments`
 * row with `nextSendAt = now()` so the next tick (or an immediate manual
 * tick) picks it up.
 *
 * Caller is responsible for audit logging and authorization. Safe to call
 * across both single and bulk paths.
 */
export async function enrollLeadInSequence(
  leadId: string,
  sequenceId: string,
): Promise<EnrollResult> {
  const [lead] = await db
    .select({ id: leads.id, email: leads.email })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return { created: false, enrollmentId: null, reason: "no_lead" };

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

  const [inserted] = await db
    .insert(leadSequenceEnrollments)
    .values({
      leadId,
      sequenceId,
      currentStep: firstTemplate.step,
      status: "active",
      nextSendAt: sql`now()`,
    })
    .onConflictDoNothing()
    .returning({ id: leadSequenceEnrollments.id });

  if (!inserted) {
    return { created: false, enrollmentId: null, reason: "already_enrolled" };
  }
  return { created: true, enrollmentId: inserted.id, reason: "ok" };
}
