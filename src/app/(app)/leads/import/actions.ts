"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, auditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { parseLeadWorkbook, toLeadInsert, type LeadInsert } from "@/lib/xlsx";

export type ImportReport = {
  inserted: number;
  duplicates: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
  warnings: string[];
  totalParsed: number;
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Bulk-load every potential duplicate match for the rows we're about to
 * import — ONE SELECT instead of one-per-row. The per-row helper became
 * the N+1 bottleneck on 500-row imports (>15s on Vercel Hobby).
 */
async function buildDedupeIndex(
  inserts: LeadInsert[],
): Promise<{ emails: Set<string>; namesNullEmail: Set<string> }> {
  const targetEmails = new Set(
    inserts
      .map((i) => i.email?.toLowerCase().trim())
      .filter((e): e is string => !!e),
  );
  const targetNames = new Set(
    inserts
      .filter((i) => !i.email)
      .map((i) => i.companyName?.toLowerCase().trim())
      .filter((n): n is string => !!n),
  );

  // Fetch every lead once and dedupe in JS. The previous WHERE used
  // `sql\`LOWER(x) = ANY(${jsArray})\`` which doesn't bind reliably
  // through Drizzle — Postgres rejected the query as malformed in some
  // runtime conditions. The leads table is small enough (hundreds of
  // rows, not millions) that one full SELECT is faster than fighting
  // the array-binding edge case.
  const rows = await db
    .select({ email: leads.email, companyName: leads.companyName })
    .from(leads);

  const emailsHit = new Set<string>();
  const namesHit = new Set<string>();
  for (const r of rows) {
    if (r.email) {
      const e = r.email.toLowerCase();
      if (targetEmails.has(e)) emailsHit.add(e);
    } else if (r.companyName) {
      const n = r.companyName.toLowerCase();
      if (targetNames.has(n)) namesHit.add(n);
    }
  }

  return { emails: emailsHit, namesNullEmail: namesHit };
}

export async function importLeadsAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const file = formData.get("file");
  const dryRun =
    formData.get("dryRun") === "true" || formData.get("dryRun") === "on";
  const sourceLabel =
    (formData.get("source") as string | null)?.trim() || "import";

  if (!(file instanceof File)) throw new Error("No file uploaded");
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${file.size} bytes; max ${MAX_BYTES}).`);
  }

  const buffer = await file.arrayBuffer();
  const parsed = await parseLeadWorkbook(buffer);

  let inserted = 0;
  let duplicates = 0;
  const warnings = [...parsed.warnings];

  if (parsed.leads.length === 0) {
    warnings.push(
      "No rows were parsed. Check that the sheet has a header row with Company, Tier, Score, etc.",
    );
  } else if (!dryRun) {
    // Build all insert payloads up-front, then ONE bulk lookup for every
    // possible duplicate, then bulk insert the survivors. Old per-row
    // approach was N+1 — 500 rows = 1000+ DB roundtrips.
    const inserts = parsed.leads.map((p) => toLeadInsert(p, sourceLabel));
    const dedupe = await buildDedupeIndex(inserts);

    const toInsert: LeadInsert[] = [];
    for (const ins of inserts) {
      const emailKey = ins.email?.toLowerCase().trim();
      const nameKey = ins.companyName?.toLowerCase().trim();
      if (emailKey && dedupe.emails.has(emailKey)) {
        duplicates++;
        continue;
      }
      if (!emailKey && nameKey && dedupe.namesNullEmail.has(nameKey)) {
        duplicates++;
        continue;
      }
      toInsert.push(ins);
    }

    if (toInsert.length > 0) {
      try {
        await db.insert(leads).values(toInsert);
        inserted = toInsert.length;
      } catch (err) {
        // A race against another inserter could re-introduce a duplicate
        // and fail the bulk insert. Fall back to one-by-one so partial
        // success is preserved.
        console.error(
          "[import] bulk insert failed; falling back row-by-row:",
          (err as Error).message,
        );
        for (const ins of toInsert) {
          try {
            await db.insert(leads).values(ins);
            inserted++;
          } catch {
            duplicates++;
          }
        }
      }
    }

    await db.insert(auditLog).values({
      actorUserId: session.user.id,
      entity: "leads",
      entityId: null,
      action: "import",
      beforeJson: null,
      afterJson: {
        inserted,
        duplicates,
        skipped: parsed.skippedRows.length,
        sourceLabel,
        fileName: file.name,
      },
    });

    revalidatePath("/leads");
    revalidatePath("/dashboard");
  }

  const params = new URLSearchParams({
    inserted: String(inserted),
    duplicates: String(duplicates),
    skipped: String(parsed.skippedRows.length),
    parsed: String(parsed.leads.length),
    dryRun: dryRun ? "1" : "0",
    warnings: warnings.length ? encodeURIComponent(warnings.join("|")) : "",
  });
  redirect(`/leads/import?${params.toString()}`);
}
