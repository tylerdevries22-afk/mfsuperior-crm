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
    const [parent] = await db
      .select({ leadId: emailEvents.leadId })
      .from(emailEvents)
      .where(eq(emailEvents.id, eventId))
      .limit(1);
    if (!parent) return;

    // Insert a separate "opened" event linked back to the same lead.
    // The unique idempotency index doesn't apply here (it's keyed on
    // enrollment_id+step+event_type) — multiple opens are allowed and
    // counted. The dashboard treats first-open as the engagement signal.
    await db.insert(emailEvents).values({
      leadId: parent.leadId,
      eventType: "opened",
      metadataJson: { sourceEventId: eventId, openedAt: new Date().toISOString() },
      occurredAt: sql`now()`,
    });
  } catch {
    // Tracking must never throw to the client.
  }
}
