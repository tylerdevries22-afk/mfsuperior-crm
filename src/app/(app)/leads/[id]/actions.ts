"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { auditLog, crmNotes, leads, stageEnum } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { createEvent } from "@/lib/calendar/client";
import { ProviderAuthError } from "@/lib/email/provider";

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

const eventSchema = z.object({
  id: z.string().uuid(),
  startsAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  summary: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  inviteLead: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
    .optional(),
  withMeet: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
    .optional(),
});

export async function scheduleFollowUpAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = eventSchema.parse({
    id: formData.get("id"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes") ?? 30,
    summary: formData.get("summary") ?? undefined,
    description: formData.get("description") ?? undefined,
    inviteLead: formData.get("inviteLead"),
    withMeet: formData.get("withMeet"),
  });

  const [lead] = await db.select().from(leads).where(eq(leads.id, parsed.id));
  if (!lead) redirect(`/leads/${parsed.id}?event_error=lead_missing`);

  const start = new Date(parsed.startsAt);
  if (Number.isNaN(start.getTime())) {
    redirect(`/leads/${parsed.id}?event_error=bad_time`);
  }

  const summary =
    parsed.summary ||
    `Follow-up: ${lead.companyName ?? lead.firstName ?? "Lead"}`;
  const end = new Date(start.getTime() + parsed.durationMinutes * 60 * 1000);
  const attendees =
    parsed.inviteLead === "on" && lead.email ? [lead.email] : undefined;

  let outcome: "ok" | "auth" | "create_failed" = "ok";
  try {
    const ev = await createEvent(session.user.id, {
      summary,
      description: parsed.description,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      attendees,
      withMeet: parsed.withMeet === "on",
    });

    await db
      .update(leads)
      .set({ nextFollowUpAt: start, updatedAt: sql`now()` })
      .where(eq(leads.id, lead.id));

    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "lead",
      entityId: lead.id,
      action: "calendar_event_created",
      beforeJson: null,
      afterJson: {
        eventId: ev.id,
        htmlLink: ev.htmlLink,
        startsAt: ev.start,
        summary: ev.summary,
      },
    });
  } catch (err) {
    outcome = err instanceof ProviderAuthError ? "auth" : "create_failed";
  }

  revalidatePath(`/leads/${lead.id}`);
  if (outcome === "ok") redirect(`/leads/${lead.id}?event_ok=1`);
  redirect(`/leads/${lead.id}?event_error=${outcome}`);
}
