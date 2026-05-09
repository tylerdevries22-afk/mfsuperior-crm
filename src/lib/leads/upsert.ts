import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { LeadInsert } from "@/lib/xlsx";

/**
 * Single upsert path for any caller writing into the `leads` table:
 *   - scripts/seed-leads.ts (xlsx import)
 *   - scripts/research-leads.ts (Places + Hunter discovery)
 *   - src/app/(app)/leads/import/actions.ts (UI upload)
 *
 * Behavior matches what scripts/seed-leads.ts had inline:
 *   - email present  → upsert on the leads_email_unique index
 *   - email null     → insert; on company-name conflict, no-op
 *
 * Optionally writes an `auditLog` row tagged with the caller-supplied
 * `actor` + `action` (e.g. "research_insert" / "research_update") so the
 * /admin audit log shows who/what populated the lead.
 */
export type UpsertResult = "inserted" | "updated" | "conflict";

export type Db = PostgresJsDatabase<typeof schema>;

export type UpsertOptions = {
  /** When set, write an auditLog entry per insert/update. */
  audit?: {
    actorUserId?: string | null;
    /** e.g. "research_insert", "research_update", "spreadsheet_insert" */
    actionPrefix: string;
    extra?: Record<string, unknown>;
  };
};

export async function upsertLead(
  db: Db,
  insert: LeadInsert,
  opts: UpsertOptions = {},
): Promise<UpsertResult> {
  let result: UpsertResult;
  let leadId: string | null = null;

  if (insert.email) {
    // Email-keyed: upsert on the email unique index.
    const [row] = await db
      .insert(schema.leads)
      .values(insert)
      .onConflictDoUpdate({
        target: schema.leads.email,
        set: {
          companyName: insert.companyName,
          vertical: insert.vertical,
          address: insert.address,
          city: insert.city,
          state: insert.state,
          phone: insert.phone,
          website: insert.website,
          tier: insert.tier,
          score: insert.score,
          tags: insert.tags,
          notes: insert.notes,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.leads.id, createdAt: schema.leads.createdAt, updatedAt: schema.leads.updatedAt });

    leadId = row?.id ?? null;
    // If created_at == updated_at this was a fresh insert; otherwise we
    // touched an existing row.
    result =
      row && row.createdAt && row.updatedAt &&
      Math.abs(row.createdAt.getTime() - row.updatedAt.getTime()) < 1000
        ? "inserted"
        : "updated";
  } else {
    // No email: insert; ignore on company-name conflict.
    const [row] = await db
      .insert(schema.leads)
      .values(insert)
      .onConflictDoNothing()
      .returning({ id: schema.leads.id });

    if (row) {
      leadId = row.id;
      result = "inserted";
    } else {
      // Find the existing row so the audit log can reference it.
      const existing = await db
        .select({ id: schema.leads.id })
        .from(schema.leads)
        .where(eq(schema.leads.companyName, insert.companyName))
        .limit(1);
      leadId = existing[0]?.id ?? null;
      result = "conflict";
    }
  }

  if (opts.audit && leadId && result !== "conflict") {
    const action = `${opts.audit.actionPrefix}_${result}`;
    await db.insert(schema.auditLog).values({
      actorUserId: opts.audit.actorUserId ?? null,
      entity: "lead",
      entityId: leadId,
      action,
      beforeJson: null,
      afterJson: {
        companyName: insert.companyName,
        email: insert.email,
        tier: insert.tier,
        score: insert.score,
        tags: insert.tags,
        ...(opts.audit.extra ?? {}),
      },
      occurredAt: sql`now()`,
    });
  }

  return result;
}
