import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { leads, notifications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { env } from "@/lib/env";

const FROM_ADDRESS = "MF Superior Solutions <info@mfsuperiorproducts.com>";
const NOTIFY_ADDRESS = "info@mfsuperiorproducts.com";

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  serviceType?: string;
  message?: string;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = env().RESEND_API_KEY;
  if (!apiKey) {
    // Log but don't fail — DB write is more important than email in dev
    console.warn("[contact/route] RESEND_API_KEY not set; skipping email send.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[contact/route] Resend error:", res.status, body);
  }
}

export async function POST(req: NextRequest) {
  const APP_URL = env().APP_URL;
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name = "", email = "", phone = "", company = "", serviceType = "", message = "" } = body;

  if (!name.trim() || !email.trim()) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 422 },
    );
  }

  const emailLower = email.trim().toLowerCase();

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
    console.error("[contact/route] DB upsert error:", err);
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
    console.error("[contact/route] Notification insert error:", err);
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
              <p style="margin:0;font-size:18px;font-weight:600;color:#D4E030;letter-spacing:0.02em;">MF Superior Solutions</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111111;">We received your quote request</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;">
                Hi ${eName},<br/><br/>
                Thanks for reaching out to MF Superior Solutions. Tyler will review your request and get back to you <strong>within 24 hours</strong> to discuss your freight needs and build a custom quote.
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
                MF Superior Solutions · 15321 E Louisiana Ave, Aurora, CO 80017, United States<br/>
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

  const confirmText = `Hi ${name.trim()},\n\nThanks for reaching out to MF Superior Solutions. Tyler will review your request and get back to you within 24 hours to discuss your freight needs and build a custom quote.\n\nIf you need to reach us sooner, call or text: (256) 468-0751\n\n--\nMF Superior Solutions\n15321 E Louisiana Ave, Aurora, CO 80017, United States`;

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
  await Promise.allSettled([
    sendEmail(
      emailLower,
      "We received your quote request — MF Superior Solutions",
      confirmHtml,
      confirmText,
    ),
    sendEmail(
      NOTIFY_ADDRESS,
      `New lead: ${name.trim()}${company.trim() ? ` — ${company.trim()}` : ""}`,
      notifyHtml,
      notifyText,
    ),
  ]);

  return NextResponse.json({ success: true });
}
