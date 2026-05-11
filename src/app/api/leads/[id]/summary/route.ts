import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
} from "@/lib/db/schema";

/**
 * GET /api/leads/[id]/summary — slim read-only payload that powers
 * the lead-detail drawer overlay on /leads.
 *
 * Returns just the data the drawer renders:
 *   • Core lead fields (company, contact, tier/stage/score, tags,
 *     notes preview, location)
 *   • Last 5 timeline events (sent / opened / clicked / replied …)
 *   • Active enrollments (max 3)
 *
 * The full lead-detail route at /leads/[id] keeps loading the
 * heavier shape (full event history, all enrollments, notes list,
 * draft action UI). The drawer is intentionally a preview — when
 * the operator needs more, they click "Open full page →".
 *
 * Session-gated. 404 on unknown ID. No write side-effects.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const [events, enrollments] = await Promise.all([
    db
      .select({
        id: emailEvents.id,
        eventType: emailEvents.eventType,
        occurredAt: emailEvents.occurredAt,
        sequenceStep: emailEvents.sequenceStep,
        templateName: emailTemplates.name,
      })
      .from(emailEvents)
      .leftJoin(
        emailTemplates,
        eq(emailTemplates.id, emailEvents.templateId),
      )
      .where(eq(emailEvents.leadId, id))
      .orderBy(desc(emailEvents.occurredAt))
      .limit(5),
    db
      .select({
        id: leadSequenceEnrollments.id,
        sequenceName: emailSequences.name,
        status: leadSequenceEnrollments.status,
        currentStep: leadSequenceEnrollments.currentStep,
        nextSendAt: leadSequenceEnrollments.nextSendAt,
      })
      .from(leadSequenceEnrollments)
      .innerJoin(
        emailSequences,
        eq(emailSequences.id, leadSequenceEnrollments.sequenceId),
      )
      .where(
        and(
          eq(leadSequenceEnrollments.leadId, id),
          // Only surface active/paused enrollments in the preview —
          // completed/canceled ones live in the full-page view.
          isNotNull(leadSequenceEnrollments.status),
        ),
      )
      .orderBy(desc(leadSequenceEnrollments.createdAt))
      .limit(3),
  ]);

  return Response.json({
    lead: {
      id: lead.id,
      companyName: lead.companyName,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
      city: lead.city,
      state: lead.state,
      vertical: lead.vertical,
      tier: lead.tier,
      stage: lead.stage,
      score: lead.score,
      tags: lead.tags ?? [],
      // Truncate notes for the preview; full notes still in the full
      // lead-detail route.
      notes: lead.notes ? lead.notes.slice(0, 400) : null,
      notesTruncated: !!(lead.notes && lead.notes.length > 400),
      lastContactedAt: lead.lastContactedAt,
      nextFollowUpAt: lead.nextFollowUpAt,
      createdAt: lead.createdAt,
    },
    events,
    enrollments,
  });
}
