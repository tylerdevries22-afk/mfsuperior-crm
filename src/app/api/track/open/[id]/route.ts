import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailEvents } from "@/lib/db/schema";

/** 1×1 transparent PNG, base64-encoded. 70 bytes on the wire. */
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const PIXEL_HEADERS = {
  "Content-Type": "image/png",
  "Content-Length": String(TRANSPARENT_PIXEL.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  // Strip the .png extension we use in the URL so apps don't load it as a doc.
  const id = raw.endsWith(".png") ? raw.slice(0, -4) : raw;

  // Fire-and-forget: never block the pixel response on the DB write.
  if (UUID_RE.test(id)) {
    void recordOpen(id);
  }

  return new Response(TRANSPARENT_PIXEL, { status: 200, headers: PIXEL_HEADERS });
}

async function recordOpen(eventId: string) {
  try {
    // Pull the FULL context of the originating send so the open event
    // is correlatable: lead, enrollment, sequence step, and template.
    // Previously we only copied leadId, which orphaned opens from the
    // sequence/template they belonged to and made per-step + per-
    // template engagement reporting impossible.
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
      console.warn(
        "[track/open] no parent event for pixel hit",
        eventId.slice(0, 8),
      );
      return;
    }

    await db.insert(emailEvents).values({
      leadId: parent.leadId,
      enrollmentId: parent.enrollmentId ?? undefined,
      sequenceStep: parent.sequenceStep ?? undefined,
      templateId: parent.templateId ?? undefined,
      eventType: "opened",
      metadataJson: {
        source: "pixel",
        sourceEventId: eventId,
        openedAt: new Date().toISOString(),
      },
      occurredAt: sql`now()`,
    });
  } catch (err) {
    // Tracking must never throw to the client, but log so we can
    // diagnose silent drops in /admin Health.
    console.error(
      "[track/open] recordOpen failed for",
      eventId.slice(0, 8),
      (err as Error).message?.slice(0, 120),
    );
  }
}
