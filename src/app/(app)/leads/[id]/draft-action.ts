"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  emailTemplates,
  leads,
  settings,
  suppressionList,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { composeEmail } from "@/lib/email/compose";
import { GmailProvider } from "@/lib/gmail/provider";
import { ProviderAuthError } from "@/lib/email/provider";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";

const schema = z.object({
  leadId: z.string().uuid(),
  templateId: z.string().uuid(),
  mode: z.enum(["draft", "send"]).default("draft"),
});

export async function draftEmailAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { leadId, templateId, mode } = schema.parse({
    leadId: formData.get("leadId"),
    templateId: formData.get("templateId"),
    mode: formData.get("mode") ?? "draft",
  });

  // Pre-flight: must have a Google connection. Dev sign-in alone won't work.
  if (!(await userHasGoogleConnection(session.user.id))) {
    redirect(`/leads/${leadId}?compose_error=no_google`);
  }

  const [lead, template, config] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!lead) redirect(`/leads?compose_error=lead_missing`);
  if (!template) redirect(`/leads/${leadId}?compose_error=template_missing`);
  if (!lead.email) {
    redirect(`/leads/${leadId}?compose_error=no_email`);
  }
  if (!config) {
    redirect(`/settings?compose_error=settings_missing`);
  }

  // Suppression check — never send/draft to a previously unsubbed/bounced address.
  const suppressed = await db
    .select({ email: suppressionList.email })
    .from(suppressionList)
    .where(eq(suppressionList.email, lead.email))
    .limit(1);
  if (suppressed[0]) {
    redirect(`/leads/${leadId}?compose_error=suppressed`);
  }

  // Pre-allocate the event id so it's used for both the open pixel + click rewrites.
  const [queued] = await db
    .insert(emailEvents)
    .values({
      leadId: lead.id,
      eventType: "queued",
      templateId: template.id,
      sequenceStep: template.sequenceStep ?? null,
      metadataJson: { mode, source: "manual" },
      occurredAt: sql`now()`,
    })
    .returning({ id: emailEvents.id });

  const composed = composeEmail({
    eventId: queued.id,
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      companyName: lead.companyName,
      city: lead.city,
      state: lead.state,
      vertical: lead.vertical,
    },
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    bodyText: template.bodyText,
    settings: {
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      senderTitle: config.senderTitle,
      senderPhone: config.senderPhone,
      businessName: config.businessName,
      businessMc: config.businessMc,
      businessUsdot: config.businessUsdot,
      businessAddress: config.businessAddress,
    },
  });

  const provider = new GmailProvider(session.user.id);
  const fromMailbox = `"${config.senderName.replace(/"/g, "\\\"")}" <${config.senderEmail}>`;

  try {
    const result =
      mode === "send"
        ? await provider.send({
            from: fromMailbox,
            to: lead.email,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: composed.headers,
          })
        : await provider.createDraft({
            from: fromMailbox,
            to: lead.email,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: composed.headers,
          });

    await db.insert(emailEvents).values({
      leadId: lead.id,
      eventType: mode === "send" ? "sent" : "draft_created",
      templateId: template.id,
      sequenceStep: template.sequenceStep ?? null,
      providerMessageId: result.providerMessageId,
      metadataJson: {
        threadId: result.threadId,
        draftId: result.draftId ?? null,
        mode,
      },
      occurredAt: sql`now()`,
    });

    if (mode !== "send") {
      // No server-side state-change; the user opens Gmail to send.
    } else {
      await db
        .update(leads)
        .set({ lastContactedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(leads.id, lead.id));
    }
  } catch (err) {
    await db.insert(emailEvents).values({
      leadId: lead.id,
      eventType: "failed",
      templateId: template.id,
      sequenceStep: template.sequenceStep ?? null,
      metadataJson: {
        error: (err as Error).message,
        kind: err instanceof ProviderAuthError ? "auth" : "other",
      },
      occurredAt: sql`now()`,
    });
    if (err instanceof ProviderAuthError) {
      redirect(`/leads/${leadId}?compose_error=auth`);
    }
    redirect(`/leads/${leadId}?compose_error=send_failed`);
  }

  revalidatePath(`/leads/${leadId}`);
  redirect(
    `/leads/${leadId}?compose_ok=${mode}&template=${encodeURIComponent(template.name)}`,
  );
}
