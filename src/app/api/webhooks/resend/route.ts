/**
 * POST /api/webhooks/resend
 *
 * Handles Resend webhook events for delivery tracking, bounces, and spam
 * complaints. Resend signs the payload with HMAC-SHA256 via the Svix library;
 * we verify before writing anything to the DB.
 *
 * Events handled:
 *   email.delivered   — update email event metadata
 *   email.bounced     — add bounced event, stop enrollment, add to suppression
 *   email.complained  — add bounced event (spam complaint), stop enrollment, add to suppression
 *   email.opened      — supplement pixel-based open tracking (Resend's own tracker)
 *   email.clicked     — supplement link-rewrite click tracking
 */

import { eq, sql, and } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  leadSequenceEnrollments,
  suppressionList,
  leads,
} from "@/lib/db/schema";

type ResendWebhookEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked";
  created_at: string;
  data: {
    email_id: string;  // maps to providerMessageId in emailEvents
    from?: string;
    to?: string[];
    subject?: string;
    [key: string]: unknown;
  };
};

async function verifySignature(req: Request): Promise<{ ok: true; body: string } | { ok: false }> {
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // In dev without the secret, skip verification so manual tests work
    if (env().NODE_ENV !== "production") {
      const body = await req.text();
      return { ok: true, body };
    }
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set in production");
    return { ok: false };
  }

  // Resend uses Svix for webhook delivery; headers we need:
  const msgId = req.headers.get("svix-id");
  const msgTs = req.headers.get("svix-timestamp");
  const msgSig = req.headers.get("svix-signature");

  if (!msgId || !msgTs || !msgSig) {
    return { ok: false };
  }

  const body = await req.text();

  // Replay protection: reject messages older than 5 minutes
  const tsMs = Number(msgTs) * 1000;
  if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return { ok: false };
  }

  // Verify HMAC-SHA256
  const toSign = `${msgId}.${msgTs}.${body}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const { createHmac } = await import("node:crypto");
  const computed = createHmac("sha256", secretBytes)
    .update(toSign)
    .digest("base64");

  // msgSig is "v1,<base64sig>" — could be multiple, comma-separated
  const signatures = msgSig.split(" ").map((s) => s.replace(/^v1,/, ""));
  const valid = signatures.some((s) => s === computed);

  return valid ? { ok: true, body } : { ok: false };
}

export async function POST(req: Request) {
  const verified = await verifySignature(req);
  if (!verified.ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(verified.body) as ResendWebhookEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return new Response("ok", { status: 200 });
  }

  // Find the sent/draft event by providerMessageId. We pull templateId
  // too so the open/click event rows below carry the full sequence-
  // step + template context — otherwise downstream dashboards can't
  // group engagement by template.
  const [parentEvent] = await db
    .select({
      id: emailEvents.id,
      leadId: emailEvents.leadId,
      enrollmentId: emailEvents.enrollmentId,
      sequenceStep: emailEvents.sequenceStep,
      templateId: emailEvents.templateId,
    })
    .from(emailEvents)
    .where(eq(emailEvents.providerMessageId, emailId))
    .limit(1);

  if (!parentEvent) {
    // Unknown email ID — could be a contact form confirmation, not a sequence email
    return new Response("ok", { status: 200 });
  }

  switch (event.type) {
    case "email.bounced":
    case "email.complained": {
      const eventType = "bounced";
      // Idempotent
      const [existing] = await db
        .select({ id: emailEvents.id })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.leadId, parentEvent.leadId),
            eq(emailEvents.eventType, eventType),
            ...(parentEvent.enrollmentId
              ? [eq(emailEvents.enrollmentId, parentEvent.enrollmentId)]
              : []),
          ),
        )
        .limit(1);

      if (!existing) {
        await db.insert(emailEvents).values({
          leadId: parentEvent.leadId,
          enrollmentId: parentEvent.enrollmentId ?? undefined,
          templateId: parentEvent.templateId ?? undefined,
          eventType,
          sequenceStep: parentEvent.sequenceStep ?? undefined,
          metadataJson: {
            source: "resend_webhook",
            webhookType: event.type,
            emailId,
          },
          occurredAt: sql`now()`,
        });

        // Stop enrollment
        if (parentEvent.enrollmentId) {
          await db
            .update(leadSequenceEnrollments)
            .set({ status: "stopped", pausedReason: "bounced", updatedAt: sql`now()` })
            .where(eq(leadSequenceEnrollments.id, parentEvent.enrollmentId));
        }

        // Add to suppression list
        const [lead] = await db
          .select({ email: leads.email })
          .from(leads)
          .where(eq(leads.id, parentEvent.leadId))
          .limit(1);

        if (lead?.email) {
          await db
            .insert(suppressionList)
            .values({
              email: lead.email,
              reason: event.type === "email.complained" ? "bounced" : "bounced",
              notes: `Resend webhook: ${event.type}`,
            })
            .onConflictDoNothing();
        }
      }
      break;
    }

    case "email.opened": {
      // Supplement pixel tracking — Resend's open tracking fires even
      // when images are blocked (e.g. Apple MPP proxy). Webhook
      // deliveries can retry on transient failures, so we guard
      // against duplicates by checking for an existing
      // resend_webhook-sourced "opened" event for the same parent
      // email. Pixel-sourced opens are a separate stream and are
      // not collapsed (different `source` metadata).
      const [dupOpen] = await db
        .select({ id: emailEvents.id })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.leadId, parentEvent.leadId),
            eq(emailEvents.eventType, "opened"),
            sql`${emailEvents.metadataJson}->>'emailId' = ${emailId}`,
            sql`${emailEvents.metadataJson}->>'source' = 'resend_webhook'`,
          ),
        )
        .limit(1);
      if (!dupOpen) {
        await db.insert(emailEvents).values({
          leadId: parentEvent.leadId,
          enrollmentId: parentEvent.enrollmentId ?? undefined,
          templateId: parentEvent.templateId ?? undefined,
          eventType: "opened",
          sequenceStep: parentEvent.sequenceStep ?? undefined,
          metadataJson: { source: "resend_webhook", emailId },
          occurredAt: sql`now()`,
        });
      }
      break;
    }

    case "email.clicked": {
      // Same idempotency story as opens. Resend includes the clicked
      // link URL in `click.link`; we collapse on (emailId, link) so
      // multiple clicks on different links still count separately
      // while a retried webhook for the same click does not.
      const clickedLink =
        (event.data as { click?: { link?: string } }).click?.link ?? "";
      const [dupClick] = await db
        .select({ id: emailEvents.id })
        .from(emailEvents)
        .where(
          and(
            eq(emailEvents.leadId, parentEvent.leadId),
            eq(emailEvents.eventType, "clicked"),
            sql`${emailEvents.metadataJson}->>'emailId' = ${emailId}`,
            sql`${emailEvents.metadataJson}->>'source' = 'resend_webhook'`,
            sql`coalesce(${emailEvents.metadataJson}->>'link', '') = ${clickedLink}`,
          ),
        )
        .limit(1);
      if (!dupClick) {
        await db.insert(emailEvents).values({
          leadId: parentEvent.leadId,
          enrollmentId: parentEvent.enrollmentId ?? undefined,
          templateId: parentEvent.templateId ?? undefined,
          eventType: "clicked",
          sequenceStep: parentEvent.sequenceStep ?? undefined,
          metadataJson: {
            source: "resend_webhook",
            emailId,
            link: clickedLink,
          },
          occurredAt: sql`now()`,
        });
      }
      break;
    }

    default:
      // email.delivered, email.sent, email.delivery_delayed — no DB action needed
      break;
  }

  return new Response("ok", { status: 200 });
}
