"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
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

async function findExistingLeadId(insert: LeadInsert): Promise<string | null> {
  if (insert.email) {
    const rows = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(sql`LOWER(${leads.email})`, insert.email))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        isNull(leads.email),
        eq(sql`LOWER(${leads.companyName})`, insert.companyName.toLowerCase()),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
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
    for (const p of parsed.leads) {
      const insert = toLeadInsert(p, sourceLabel);
      const existingId = await findExistingLeadId(insert);
      if (existingId) {
        duplicates++;
        continue;
      }
      await db.insert(leads).values(insert);
      inserted++;
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
