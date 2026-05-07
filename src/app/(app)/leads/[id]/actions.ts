"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { auditLog, crmNotes, leads, stageEnum } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

const STAGE_VALUES = stageEnum.enumValues;

const stageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(STAGE_VALUES),
});

export async function updateStageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { id, stage } = stageSchema.parse({
    id: formData.get("id"),
    stage: formData.get("stage"),
  });

  const [before] = await db.select().from(leads).where(eq(leads.id, id));
  if (!before) throw new Error("Lead not found");

  const lastContacted =
    stage !== "new" && stage !== before.stage ? sql`now()` : undefined;

  await db
    .update(leads)
    .set({
      stage,
      updatedAt: sql`now()`,
      ...(lastContacted ? { lastContactedAt: lastContacted } : {}),
    })
    .where(eq(leads.id, id));

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "lead",
    entityId: id,
    action: "stage_change",
    beforeJson: { stage: before.stage },
    afterJson: { stage },
  });

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

const noteSchema = z.object({
  id: z.string().uuid(),
  note: z.string().trim().min(1).max(4000),
});

export async function addNoteAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { id, note } = noteSchema.parse({
    id: formData.get("id"),
    note: formData.get("note"),
  });

  await db.insert(crmNotes).values({
    leadId: id,
    note,
    createdBy: session.user.id,
  });

  revalidatePath(`/leads/${id}`);
}

const archiveSchema = z.object({ id: z.string().uuid() });

export async function archiveLeadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { id } = archiveSchema.parse({ id: formData.get("id") });

  await db
    .update(leads)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(leads.id, id));

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    entity: "lead",
    entityId: id,
    action: "archive",
    beforeJson: null,
    afterJson: null,
  });

  redirect("/leads");
}
