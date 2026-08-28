import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailClicks, emailEvents } from "@/lib/db/schema";
import { PersistentRateLimiter } from "@/lib/mobile-api/rate-limit";
import {
  clickTargetSignatureIsValid,
  fromB64url,
} from "@/lib/tracking/links";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);
const trackingLimiter = new PersistentRateLimiter();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const encoded = url.searchParams.get("u") ?? "";
  const signature = url.searchParams.get("s") ?? "";

  if (!UUID_RE.test(id)) {
    return new Response("Bad tracking link", { status: 400 });
  }

  let target: string;
  try {
    target = fromB64url(encoded);
    const parsed = new URL(target);
    if (
      !SAFE_PROTOCOLS.has(parsed.protocol)
      || !clickTargetSignatureIsValid(id, target, signature)
    ) {
      return new Response("Bad target protocol", { status: 400 });
    }
  } catch {
    return new Response("Bad target", { status: 400 });
  }

  await recordClick(id, target);

  redirect(target);
}

async function recordClick(eventId: string, target: string) {
  try {
    const rateLimit = await trackingLimiter.consume({
      key: `tracking:click:${eventId}`,
      limit: 20,
      windowMs: 24 * 60 * 60 * 1_000,
    });
    if (!rateLimit.allowed) return;
    // Same propagation rationale as the open pixel: copy the full
    // context (enrollment / step / template) from the originating
    // send so clicks remain joinable to the sequence step they came
    // from. Previously only leadId came through, breaking template-
    // and step-level engagement reporting.
    const [parent] = await db
      .select({
        leadId: emailEvents.leadId,
        enrollmentId: emailEvents.enrollmentId,
        sequenceStep: emailEvents.sequenceStep,
        templateId: emailEvents.templateId,
      })
      .from(emailEvents)
      .where(eq(emailEvents.id, eventId))
      .limit(1);
    if (!parent) {
      console.warn(JSON.stringify({
        severity: "warn",
        event: "tracking_click_parent_missing",
        eventIdPrefix: eventId.slice(0, 8),
      }));
      return;
    }

    const [clickEvent] = await db
      .insert(emailEvents)
      .values({
        leadId: parent.leadId,
        enrollmentId: parent.enrollmentId ?? undefined,
        sequenceStep: parent.sequenceStep ?? undefined,
        templateId: parent.templateId ?? undefined,
        eventType: "clicked",
        metadataJson: { source: "link-rewrite", sourceEventId: eventId, target },
        occurredAt: sql`now()`,
      })
      .returning({ id: emailEvents.id });

    await db.insert(emailClicks).values({
      leadId: parent.leadId,
      emailEventId: clickEvent.id,
      url: target,
      trackingId: eventId,
    });
  } catch (err) {
    console.error(JSON.stringify({
      severity: "error",
      event: "tracking_click_record_failed",
      errorName: err instanceof Error ? err.name : "unknown",
      eventIdPrefix: eventId.slice(0, 8),
    }));
  }
}
