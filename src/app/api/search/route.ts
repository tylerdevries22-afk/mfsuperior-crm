import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { emailSequences, emailTemplates, leads } from "@/lib/db/schema";

/**
 * GET /api/search?q=...  — fast multi-entity search for the Cmd+K
 * command palette. Returns up to 5 leads / 5 templates / 5 sequences
 * matching the operator's free-text query.
 *
 * Auth: session-gated; the palette only fires for authed operators
 * inside (app), but the route enforces this directly so it can't be
 * scraped by a leaked session-less URL.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ leads: [], templates: [], sequences: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return Response.json({ leads: [], templates: [], sequences: [] });
  }
  // Escape LIKE wildcards so a user typing `%foo` doesn't accidentally
  // run an unbounded scan.
  const qEsc = q.replace(/[%_\\]/g, "\\$&");
  const needle = `%${qEsc}%`;

  const [leadRows, templateRows, sequenceRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        email: leads.email,
        city: leads.city,
        stage: leads.stage,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.archivedAt),
          or(
            ilike(leads.companyName, needle),
            ilike(leads.email, needle),
            ilike(leads.city, needle),
            ilike(leads.vertical, needle),
          ),
        ),
      )
      .orderBy(sql`length(${leads.companyName})`) // shortest match first (prefix-ish)
      .limit(5),
    db
      .select({
        id: emailTemplates.id,
        name: emailTemplates.name,
        subject: emailTemplates.subject,
      })
      .from(emailTemplates)
      .where(
        or(
          ilike(emailTemplates.name, needle),
          ilike(emailTemplates.subject, needle),
        ),
      )
      .limit(5),
    db
      .select({
        id: emailSequences.id,
        name: emailSequences.name,
        status: emailSequences.status,
      })
      .from(emailSequences)
      .where(ilike(emailSequences.name, needle))
      .limit(5),
  ]);

  return Response.json({
    leads: leadRows,
    templates: templateRows,
    sequences: sequenceRows,
  });
}
