"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  auditLog,
  emailSequences,
  emailTemplates,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { SEED_SEQUENCE_NAME, SEED_TEMPLATES } from "@/lib/email/seed-templates";

const upsertSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(40_000),
  bodyText: z.string().min(1).max(40_000),
  sendMode: z.enum(["draft", "auto_send"]).default("draft"),
  isActive: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(true),
});

export async function upsertTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = upsertSchema.parse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    subject: formData.get("subject"),
    bodyHtml: formData.get("bodyHtml"),
    bodyText: formData.get("bodyText"),
    sendMode: formData.get("sendMode") ?? "draft",
    isActive: formData.get("isActive"),
  });

  let templateId: string;
  if (parsed.id) {
    await db
      .update(emailTemplates)
      .set({
        name: parsed.name,
        subject: parsed.subject,
        bodyHtml: parsed.bodyHtml,
        bodyText: parsed.bodyText,
        sendMode: parsed.sendMode,
        isActive: parsed.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(emailTemplates.id, parsed.id));
    templateId = parsed.id;
    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "template",
      entityId: parsed.id,
      action: "update",
      beforeJson: null,
      afterJson: null,
    });
  } else {
    const [created] = await db
      .insert(emailTemplates)
      .values({
        name: parsed.name,
        subject: parsed.subject,
        bodyHtml: parsed.bodyHtml,
        bodyText: parsed.bodyText,
        sendMode: parsed.sendMode,
        isActive: parsed.isActive,
      })
      .returning({ id: emailTemplates.id });
    templateId = created.id;
    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "template",
      entityId: templateId,
      action: "create",
      beforeJson: null,
      afterJson: null,
    });
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  redirect(`/templates/${templateId}`);
}

export async function seedKitTemplatesAction() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Find or create the seed sequence.
  const existingSeq = await db
    .select({ id: emailSequences.id })
    .from(emailSequences)
    .where(eq(emailSequences.name, SEED_SEQUENCE_NAME))
    .limit(1);

  let sequenceId: string;
  if (existingSeq[0]) {
    sequenceId = existingSeq[0].id;
  } else {
    const [created] = await db
      .insert(emailSequences)
      .values({
        name: SEED_SEQUENCE_NAME,
        status: "active",
        steps: SEED_TEMPLATES.map((t) => ({
          step: t.step,
          delayDays: t.delayDays,
        })),
      })
      .returning({ id: emailSequences.id });
    sequenceId = created.id;
  }

  // For each step: insert only if not already present for this sequence.
  const existing = await db
    .select({ step: emailTemplates.sequenceStep })
    .from(emailTemplates)
    .where(eq(emailTemplates.sequenceId, sequenceId));
  const existingSteps = new Set(existing.map((r) => r.step));

  const inserted: string[] = [];
  for (const t of SEED_TEMPLATES) {
    if (existingSteps.has(t.step)) continue;
    const [row] = await db
      .insert(emailTemplates)
      .values({
        name: t.name,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        sequenceId,
        sequenceStep: t.step,
        sendMode: "draft",
        isActive: true,
      })
      .returning({ id: emailTemplates.id });
    inserted.push(row.id);
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "templates",
    entityId: null,
    action: "seed_kit",
    beforeJson: null,
    afterJson: { inserted: inserted.length, sequenceId },
  });

  revalidatePath("/templates");
  redirect("/templates");
}
