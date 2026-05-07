import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  leadSequenceEnrollments,
  leads,
  suppressionList,
  unsubscribes,
} from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/tracking/unsubscribe";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
};

function page({
  title,
  message,
  ok,
}: {
  title: string;
  message: string;
  ok: boolean;
}) {
  const accent = ok ? "#1747d6" : "#b91c1c";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>
    *{box-sizing:border-box} body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    main{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;max-width:480px;width:100%}
    h1{margin:0 0 12px;font-size:18px;font-weight:600;letter-spacing:-0.01em}
    p{margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;background:${accent};color:#fff;margin-bottom:14px}
  </style></head><body><main><span class="badge">${ok ? "Unsubscribed" : "Error"}</span><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

async function processUnsubscribe(token: string, source: "link" | "post") {
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return new Response(
      page({
        title: "Invalid unsubscribe link",
        message:
          "We couldn't verify this unsubscribe link. If you continue to receive unwanted email, reply directly with STOP and we'll remove you manually.",
        ok: false,
      }),
      { status: 400, headers: HTML_HEADERS },
    );
  }

  const [lead] = await db
    .select({ id: leads.id, email: leads.email, companyName: leads.companyName })
    .from(leads)
    .where(eq(leads.id, verified.leadId))
    .limit(1);

  if (!lead) {
    return new Response(
      page({
        title: "Lead not found",
        message:
          "The lead this link points to no longer exists in our system, so there's nothing to unsubscribe.",
        ok: false,
      }),
      { status: 404, headers: HTML_HEADERS },
    );
  }

  await db.insert(unsubscribes).values({
    leadId: lead.id,
    email: lead.email ?? "(no email on file)",
    source,
  });

  if (lead.email) {
    await db
      .insert(suppressionList)
      .values({ email: lead.email, reason: "unsubscribed" })
      .onConflictDoNothing();
  }

  await db
    .update(leadSequenceEnrollments)
    .set({
      status: "stopped",
      pausedReason: "unsubscribed",
      updatedAt: sql`now()`,
    })
    .where(eq(leadSequenceEnrollments.leadId, lead.id));

  await db.insert(emailEvents).values({
    leadId: lead.id,
    eventType: "unsubscribed",
    metadataJson: { source },
    occurredAt: sql`now()`,
  });

  return new Response(
    page({
      title: "You've been unsubscribed",
      message: `${lead.companyName ?? "That contact"} has been removed from our outreach. We won't email this address again.`,
      ok: true,
    }),
    { status: 200, headers: HTML_HEADERS },
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return processUnsubscribe(token, "link");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  // RFC 8058 one-click POST from Gmail's native unsubscribe button.
  const { token } = await params;
  return processUnsubscribe(token, "post");
}
