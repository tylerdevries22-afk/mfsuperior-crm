import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailClicks, emailEvents } from "@/lib/db/schema";
import { fromB64url } from "@/lib/tracking/links";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const encoded = url.searchParams.get("u") ?? "";

  let target: string;
  try {
    target = fromB64url(encoded);
    const parsed = new URL(target);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
      return new Response("Bad target protocol", { status: 400 });
    }
  } catch {
    return new Response("Bad target", { status: 400 });
  }

  if (UUID_RE.test(id)) {
    await recordClick(id, target);
  }

  redirect(target);
}

async function recordClick(eventId: string, target: string) {
  try {
    const [parent] = await db
      .select({ leadId: emailEvents.leadId })
      .from(emailEvents)
      .where(eq(emailEvents.id, eventId))
      .limit(1);
    if (!parent) return;

    const [clickEvent] = await db
      .insert(emailEvents)
      .values({
        leadId: parent.leadId,
        eventType: "clicked",
        metadataJson: { sourceEventId: eventId, target },
        occurredAt: sql`now()`,
      })
      .returning({ id: emailEvents.id });

    await db.insert(emailClicks).values({
      leadId: parent.leadId,
      emailEventId: clickEvent.id,
      url: target,
      trackingId: eventId,
    });
  } catch {
    // Never throw on tracking side-effects.
  }
}
