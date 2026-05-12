/**
 * Auto-runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for any
 * schema additions the deployed code expects but a target database
 * may be missing. Mirrors `PENDING_DDL` in
 * src/app/(app)/admin/actions.ts — the operator-triggered button
 * stays as a manual escape hatch, but this helper makes the app
 * self-healing on cold start so a typical user never sees a 500.
 *
 * Why this exists: PRs that add columns to the Drizzle schema
 * change `$inferSelect`, so the very first `db.select().from(...)`
 * after deploy already references the new column. Without an
 * `IF NOT EXISTS` ALTER, that SELECT throws and the page 500s
 * until somebody with shell access runs `npm run db:push`.
 * Running the DDL automatically — once per Lambda warm process —
 * closes that window.
 *
 * The statements are bounded, idempotent, and safe to repeat. The
 * module-level `done` flag avoids hammering the DB on every page
 * load.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * SQL statements that need to run before the current deployed code
 * can safely query the database. Each statement is its own row —
 * one failure shouldn't abort the rest.
 *
 * Keep this list mirrored with `PENDING_DDL` in admin/actions.ts
 * so the operator-triggered button covers the same set.
 *
 * Drop entries once they've definitely landed in every database
 * (production + all dev / preview branches).
 */
const STATEMENTS: ReadonlyArray<string> = [
  // Added by PR #46 (email-trust pipeline).
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "email_trust" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "email_validated_at" timestamp with time zone`,
];

// Module-level flag. Survives between requests inside a single
// Lambda warm process; a fresh cold start re-runs the DDL (no harm
// — every statement is idempotent).
let done = false;
let inflight: Promise<void> | null = null;

export async function ensureSchemaUpToDate(): Promise<void> {
  if (done) return;
  // If two parallel requests reach this at the same time on a cold
  // start, share the same in-flight promise so we only hit the DB
  // once.
  if (inflight) return inflight;

  inflight = (async () => {
    for (const stmt of STATEMENTS) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err) {
        // Don't crash callers if a single statement fails — the
        // operator-triggered button on /admin Health surfaces full
        // errors. Log so the issue is visible in Vercel logs.
        console.error(
          "[ensureSchemaUpToDate] statement failed:",
          stmt,
          (err as Error).message,
        );
      }
    }
    done = true;
  })();

  try {
    await inflight;
  } finally {
    inflight = null;
  }
}
