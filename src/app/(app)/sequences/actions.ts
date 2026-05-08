"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { auditLog, leads } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { enrollLeadInSequence } from "@/lib/sequences/enroll";

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

  const result = await enrollLeadInSequence(leadId, sequenceId);

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
    const r = await enrollLeadInSequence(c.id, parsed.sequenceId);
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

