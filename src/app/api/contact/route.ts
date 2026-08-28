import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { auditLog, emailEvents, leads, notifications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { readBoundedBody } from "@/lib/http/read-bounded-body";
import { fetchWithRetry } from "@/lib/mobile-api/external-fetch";
import { PersistentRateLimiter } from "@/lib/mobile-api/rate-limit";

const FROM_ADDRESS = "MF Superior Products <info@mfsuperiorproducts.com>";
const NOTIFY_ADDRESS = "info@mfsuperiorproducts.com";

/**
 * This endpoint is unauthenticated and CORS-open by design — it backs the
 * public marketing form. That makes it the one place where an anonymous
 * caller can cause a database write and two outbound emails, so every field
 * is length-bounded and the whole route is rate limited. Without those, it is
 * a spam amplifier that burns the Resend quota and fills the leads table.
 */
const contactBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().max(40).optional().default(""),
    company: z.string().trim().max(200).optional().default(""),
    serviceType: z.string().trim().max(80).optional().default(""),
    message: z.string().trim().max(5000).optional().default(""),
  })
  .strict();

const rateLimiter = new PersistentRateLimiter();

/** Submissions allowed per client address, and per submitted email, hourly. */
const PER_ADDRESS_HOURLY_LIMIT = 5;
const PER_EMAIL_HOURLY_LIMIT = 3;
const HOUR_MS = 60 * 60 * 1000;
const MAXIMUM_CONTACT_BODY_BYTES = 64 * 1024;

/**
 * Trusts the left-most `x-forwarded-for` entry, which on Vercel is the client
 * address the platform observed. Falls back to a constant bucket so a missing
 * header degrades to a shared limit rather than to no limit at all.
 */
function clientAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown-client";
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

type SendResult = { ok: true } | { ok: false; reason: string };

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  idempotencyKey: string,
): Promise<SendResult> {
  const apiKey = env().RESEND_API_KEY;
  if (!apiKey) {
    console.warn(JSON.stringify({
      severity: "warn",
      event: "contact_email_skipped",
      reason: "RESEND_API_KEY_missing",
    }));
    return { ok: false, reason: "RESEND_API_KEY_missing" };
  }
  try {
    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
    }, {
      maxAttempts: 2,
      timeoutMs: 8_000,
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        severity: "error",
        event: "contact_email_provider_failure",
        status: res.status,
      }));
      return { ok: false, reason: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({
      severity: "error",
      event: "contact_email_transport_failure",
      errorName: err instanceof Error ? err.name : "unknown",
    }));
    return { ok: false, reason: "resend_threw" };
  }
}

// Preflight handler so cross-origin POSTs from embedded contact forms
// (e.g. a marketing iframe on a different domain) succeed instead of
// failing the CORS preflight. Headers themselves are set in next.config.ts.
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const APP_URL = env().APP_URL;

  const body = await readBoundedBody(req, MAXIMUM_CONTACT_BODY_BYTES);
  if (!body.success) {
    return NextResponse.json({ error: "The quote request is too large." }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = body.text ? JSON.parse(body.text) : undefined;
  } catch {
    raw = undefined;
  }
  if (raw === undefined) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = contactBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a valid name and email address." },
      { status: 422 },
    );
  }
  const { name, phone, company, serviceType, message } = parsed.data;
  const emailLower = parsed.data.email;

  const address = await rateLimiter.consume({
    key: `contact:ip:${clientAddress(req)}`,
    limit: PER_ADDRESS_HOURLY_LIMIT,
    windowMs: HOUR_MS,
  });
  const perEmail = await rateLimiter.consume({
    key: `contact:email:${emailLower}`,
    limit: PER_EMAIL_HOURLY_LIMIT,
    windowMs: HOUR_MS,
  });
  if (!address.allowed || !perEmail.allowed) {
    const resetAt = address.allowed ? perEmail.resetAt : address.resetAt;
    return NextResponse.json(
      {
        error:
          "Too many quote requests from this sender. Please try again later, or call (256) 468-0751.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  // ── Upsert lead ──────────────────────────────────────────────────────────
  let leadId: string;
  try {
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, emailLower))
      .limit(1);

    if (existing.length > 0) {
      leadId = existing[0].id;
      // Update contact details that may be fresher
      await db
        .update(leads)
        .set({
          phone: phone.trim() || undefined,
          companyName: company.trim() || undefined,
          notes: message.trim()
            ? sql`CASE WHEN ${leads.notes} IS NULL THEN ${message.trim()} ELSE ${leads.notes} || E'\n\n' || ${"Website inquiry: " + message.trim()} END`
            : undefined,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    } else {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? null;
      const lastName = nameParts.slice(1).join(" ") || null;

      const [inserted] = await db
        .insert(leads)
        .values({
          email: emailLower,
          firstName,
          lastName,
          phone: phone.trim() || null,
          companyName: company.trim() || null,
          source: "website_contact",
          notes: message.trim() || null,
          tags: serviceType ? [serviceType] : [],
        })
        .returning({ id: leads.id });

      leadId = inserted.id;
    }
  } catch (err) {
    console.error(JSON.stringify({
      severity: "error",
      event: "contact_lead_upsert_failed",
      errorName: err instanceof Error ? err.name : "unknown",
    }));
    return NextResponse.json(
      { error: "Failed to save your request. Please try again." },
      { status: 500 },
    );
  }

  // ── Create notification ───────────────────────────────────────────────────
  try {
    await db.insert(notifications).values({
      type: "lead_submitted",
      title: `New quote request: ${name.trim()}`,
      body: `${company ? company + " · " : ""}${emailLower}${serviceType ? " · " + serviceType : ""}`,
      leadId,
    });
  } catch (err) {
    // Non-fatal
    console.error(JSON.stringify({
      severity: "error",
      event: "contact_notification_insert_failed",
      errorName: err instanceof Error ? err.name : "unknown",
      leadId,
    }));
  }

  // ── Confirmation email to submitter ──────────────────────────────────────
  const eName = escHtml(name.trim());
  const eCompany = escHtml(company.trim());
  const eEmail = escHtml(emailLower);
  const ePhone = escHtml(phone.trim());
  const eService = escHtml(serviceType);
  const eMessage = escHtml(message.trim());

  const confirmHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Quote Request Received</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111111;padding:28px 40px;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#D4E030;letter-spacing:0.02em;">MF Superior Products</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111111;">We received your quote request</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;">
                Hi ${eName},<br/><br/>
                Thanks for reaching out to MF Superior Products. Tyler will review your request and get back to you <strong>within 24 hours</strong> to discuss your freight needs and build a custom quote.
              </p>
              ${eService ? `<p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;"><strong>Service requested:</strong> ${eService}</p>` : ""}
              ${eMessage ? `<p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;"><strong>Your message:</strong><br/><em>${eMessage}</em></p>` : ""}
              <p style="margin:24px 0 0;font-size:15px;color:#444444;line-height:1.6;">
                If you need to reach us sooner, call or text:<br/>
                <a href="tel:+12564680751" style="color:#111111;font-weight:600;">(256) 468-0751</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.5;">
                MF Superior Products · 15321 E Louisiana Ave, Aurora, CO 80017, United States<br/>
                This email was sent because you submitted a quote request at mfsuperiorproducts.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const confirmText = `Hi ${name.trim()},\n\nThanks for reaching out to MF Superior Products. Tyler will review your request and get back to you within 24 hours to discuss your freight needs and build a custom quote.\n\nIf you need to reach us sooner, call or text: (256) 468-0751\n\n--\nMF Superior Products\n15321 E Louisiana Ave, Aurora, CO 80017, United States`;

  // ── Notification email to team ────────────────────────────────────────────
  const crmLink = `${APP_URL}/leads/${leadId}`;
  const notifyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>New Lead</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111111;padding:24px 40px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#D4E030;letter-spacing:0.1em;text-transform:uppercase;font-family:monospace;">New Quote Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#111111;">${eName}${eCompany ? ` — ${eCompany}` : ""}</h1>
              <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#999999;width:120px;">Name</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#111111;">${eName}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#999999;">Email</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#111111;"><a href="mailto:${eEmail}" style="color:#111111;">${eEmail}</a></td></tr>
                ${ePhone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#999999;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#111111;"><a href="tel:${ePhone}" style="color:#111111;">${ePhone}</a></td></tr>` : ""}
                ${eCompany ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#999999;">Company</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#111111;">${eCompany}</td></tr>` : ""}
                ${eService ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#999999;">Service</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#111111;">${eService}</td></tr>` : ""}
                ${eMessage ? `<tr><td style="padding:8px 0;font-size:13px;color:#999999;vertical-align:top;padding-top:12px;">Message</td><td style="padding:8px 0;font-size:14px;color:#111111;line-height:1.5;padding-top:12px;">${eMessage}</td></tr>` : ""}
              </table>
              <div style="margin-top:28px;">
                <a href="${crmLink}" style="display:inline-block;background:#111111;color:#D4E030;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;font-family:monospace;">View in CRM</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const notifyText = `New quote request from ${name.trim()}${company.trim() ? ` (${company.trim()})` : ""}\n\nEmail: ${emailLower}\nPhone: ${phone.trim() || "—"}\nService: ${serviceType || "—"}\n\nMessage:\n${message.trim() || "—"}\n\nView in CRM: ${crmLink}`;

  // Fire emails concurrently — non-blocking on failure
  const submissionId = randomUUID();
  const [confirmSettled, notifySettled] = await Promise.allSettled([
    sendEmail(
      emailLower,
      "We received your quote request — MF Superior Products",
      confirmHtml,
      confirmText,
      `contact-confirmation/${leadId}/${submissionId}`,
    ),
    sendEmail(
      NOTIFY_ADDRESS,
      `New lead: ${name.trim()}${company.trim() ? ` — ${company.trim()}` : ""}`,
      notifyHtml,
      notifyText,
      `contact-notification/${leadId}/${submissionId}`,
    ),
  ]);

  const confirmResult: SendResult =
    confirmSettled.status === "fulfilled"
      ? confirmSettled.value
      : { ok: false, reason: "rejected" };
  const notifyResult: SendResult =
    notifySettled.status === "fulfilled"
      ? notifySettled.value
      : { ok: false, reason: "rejected" };

  // Record an emailEvents row per outbound — `sent` on success, `failed`
  // with a kind metadata on the missing-key / Resend-error paths. This
  // is what makes the contact-form outbound visible in /inbox; without
  // it the operator sees the lead but no "we emailed them back" trail.
  try {
    await db.insert(emailEvents).values([
      {
        leadId,
        enrollmentId: null,
        eventType: confirmResult.ok ? "sent" : "failed",
        templateId: null,
        sequenceStep: null,
        metadataJson: {
          direction: "confirmation_to_submitter",
          to: emailLower,
          provider: "resend",
          ...(confirmResult.ok ? {} : { kind: confirmResult.reason }),
        },
        occurredAt: sql`now()` as unknown as Date,
      },
      {
        leadId,
        enrollmentId: null,
        eventType: notifyResult.ok ? "sent" : "failed",
        templateId: null,
        sequenceStep: null,
        metadataJson: {
          direction: "notification_to_team",
          to: NOTIFY_ADDRESS,
          provider: "resend",
          ...(notifyResult.ok ? {} : { kind: notifyResult.reason }),
        },
        occurredAt: sql`now()` as unknown as Date,
      },
    ]);
  } catch (err) {
    console.error(JSON.stringify({
      severity: "error",
      event: "contact_email_audit_insert_failed",
      errorName: err instanceof Error ? err.name : "unknown",
      leadId,
    }));
  }

  try {
    await db.insert(auditLog).values({
      actorUserId: null,
      entity: "lead",
      entityId: leadId,
      action: "contact_form_submitted",
      beforeJson: null,
      afterJson: {
        email: emailLower,
        company: company.trim() || null,
        serviceType: serviceType || null,
        confirmation: confirmResult,
        notification: notifyResult,
      },
      occurredAt: sql`now()`,
    });
  } catch (err) {
    console.error(JSON.stringify({
      severity: "error",
      event: "contact_audit_log_insert_failed",
      errorName: err instanceof Error ? err.name : "unknown",
      leadId,
    }));
  }

  // Provider and internal record details remain in the audit trail. Returning
  // them from this anonymous endpoint would disclose operational state.
  return NextResponse.json({ success: true });
}
