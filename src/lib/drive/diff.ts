/**
 * Pure diff logic for Drive sync. Pulls in two arrays — what's in the sheet,
 * what's in the DB — and returns three buckets:
 *   inserts    — sheet rows with no DB match (will be inserted)
 *   confirmed  — sheet rows that match an existing DB lead (sync timestamp updates)
 *   orphans    — DB leads not present in the sheet (flagged, never deleted)
 *
 * Match rule (in order):
 *   1. By lower-cased email (if both sides have an email)
 *   2. By lower-cased trimmed company name
 *
 * "Force update" of editable fields is intentionally NOT implemented in v1.
 * Sheet → DB updates are out of scope until we have hash-based change
 * detection + conflict resolution. Confirmed leads only have lastSyncedAt
 * touched.
 */

export type SheetRow = {
  email: string | null;
  companyName: string;
  /** Free-form payload the caller passes through; only matched against on key fields. */
  raw: unknown;
};

export type DbLead = {
  id: string;
  email: string | null;
  companyName: string | null;
  source: string | null;
};

export type DiffResult = {
  inserts: SheetRow[];
  confirmed: Array<{ leadId: string; row: SheetRow }>;
  orphans: DbLead[];
};

const norm = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function diffSheetVsDb(opts: {
  sheet: SheetRow[];
  db: DbLead[];
  /** When true, only DB leads with this source are eligible to become orphans. */
  orphanSource?: string;
}): DiffResult {
  const sheetByEmail = new Map<string, SheetRow>();
  const sheetByCompany = new Map<string, SheetRow>();
  for (const r of opts.sheet) {
    const e = norm(r.email);
    if (e) sheetByEmail.set(e, r);
    const c = norm(r.companyName);
    if (c) sheetByCompany.set(c, r);
  }

  const inserts: SheetRow[] = [];
  const confirmed: Array<{ leadId: string; row: SheetRow }> = [];
  const matchedSheetRows = new Set<SheetRow>();

  // First pass: every sheet row tries to find a DB lead.
  for (const row of opts.sheet) {
    const e = norm(row.email);
    const c = norm(row.companyName);

    let match: DbLead | undefined;
    if (e) match = opts.db.find((d) => norm(d.email) === e);
    if (!match && c) match = opts.db.find((d) => !norm(d.email) && norm(d.companyName) === c);

    if (match) {
      confirmed.push({ leadId: match.id, row });
      matchedSheetRows.add(row);
    } else {
      inserts.push(row);
    }
  }

  // Second pass: orphans are DB leads that aren't matched by anything in the sheet.
  const matchedLeadIds = new Set(confirmed.map((c) => c.leadId));
  const orphans = opts.db.filter((d) => {
    if (matchedLeadIds.has(d.id)) return false;
    if (opts.orphanSource && d.source !== opts.orphanSource) return false;
    return true;
  });

  void matchedSheetRows; // kept for future "duplicate sheet rows" detection
  void sheetByEmail;
  void sheetByCompany;

  return { inserts, confirmed, orphans };
}
