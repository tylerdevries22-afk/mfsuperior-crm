import { asc, eq, sql, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  auditLog,
  driveSyncState,
  leads,
  settings as settingsTable,
  users,
} from "@/lib/db/schema";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";
import {
  downloadFileBytes,
  listLeadSpreadsheets,
} from "@/lib/drive/client";
import { parseLeadWorkbook, toLeadInsert } from "@/lib/xlsx";
import { diffSheetVsDb, type SheetRow } from "@/lib/drive/diff";

export type DriveSyncReport = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sourceFile: string | null;
  sheetRows: number;
  inserted: number;
  confirmed: number;
  orphansFlagged: number;
  orphansCleared: number;
  notes: string[];
};

const SYNC_SOURCE = "drive_sync";

export async function syncDrive(): Promise<DriveSyncReport> {
  const start = new Date();
  const startMs = start.getTime();
  const notes: string[] = [];
  const report: DriveSyncReport = {
    startedAt: start.toISOString(),
    finishedAt: start.toISOString(),
    durationMs: 0,
    sourceFile: null,
    sheetRows: 0,
    inserted: 0,
    confirmed: 0,
    orphansFlagged: 0,
    orphansCleared: 0,
    notes,
  };

  // 1. Resolve operator user (same model as tick + poll).
  const operator = await findOperatorUser();
  if (!operator) {
    notes.push("no operator user with Google connection — skipping sync");
    return finalize(report, startMs);
  }

  // 2. Read settings for the configured Drive folder id.
  const [config] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1));
  if (!config) {
    notes.push("settings row missing — open /settings and save");
    return finalize(report, startMs);
  }
  if (!config.driveFolderId) {
    notes.push("DRIVE_FOLDER_ID not set in settings — sync is opt-in");
    return finalize(report, startMs);
  }

  // 3. Find the freshest lead-list xlsx in the folder.
  let candidates;
  try {
    candidates = await listLeadSpreadsheets(operator.id, config.driveFolderId);
  } catch (err) {
    notes.push(`drive list failed: ${(err as Error).message}`);
    return finalize(report, startMs);
  }
  if (candidates.length === 0) {
    notes.push("no .xlsx files matching 'Lead' found in the configured folder");
    return finalize(report, startMs);
  }
  const file = candidates[0];
  report.sourceFile = `${file.name} (${file.id.slice(0, 8)}…)`;

  // 4. Download + parse.
  let buffer: ArrayBuffer;
  try {
    buffer = await downloadFileBytes(operator.id, file.id);
  } catch (err) {
    notes.push(`drive download failed: ${(err as Error).message}`);
    return finalize(report, startMs);
  }
  const parsed = await parseLeadWorkbook(buffer);
  notes.push(...parsed.warnings);
  report.sheetRows = parsed.leads.length;
  if (parsed.leads.length === 0) {
    notes.push("workbook parsed but yielded zero rows");
    await markSyncTimestamp();
    return finalize(report, startMs);
  }

  // 5. Build the diff against current DB state.
  const sheetRows: SheetRow[] = parsed.leads.map((p) => ({
    email: p.email,
    companyName: p.companyName,
    raw: p,
  }));
  const dbLeads = await db
    .select({
      id: leads.id,
      email: leads.email,
      companyName: leads.companyName,
      source: leads.source,
    })
    .from(leads)
    .where(isNull(leads.archivedAt));

  const { inserts, confirmed, orphans } = diffSheetVsDb({
    sheet: sheetRows,
    db: dbLeads,
    // Only previously-imported (denver_kit_2026 OR drive_sync) leads can become
    // orphans on a sheet sync. Manually-created leads stay clean.
    orphanSource: undefined, // null/undefined = consider every match candidate
  });

  // 6. Insert new rows.
  for (const row of inserts) {
    const insert = toLeadInsert(row.raw as Parameters<typeof toLeadInsert>[0], SYNC_SOURCE);
    await db
      .insert(leads)
      .values({
        ...insert,
        lastSyncedAt: sql`now()`,
        driveFileId: file.id,
        driveSyncOrphan: false,
      })
      .onConflictDoNothing();
    report.inserted++;
  }

  // 7. Confirm existing matches: touch lastSyncedAt + clear orphan flag.
  for (const c of confirmed) {
    await db
      .update(leads)
      .set({
        lastSyncedAt: sql`now()`,
        driveFileId: file.id,
        driveSyncOrphan: false,
        updatedAt: sql`now()`,
      })
      .where(eq(leads.id, c.leadId));
    report.confirmed++;
  }

  // 8. Capture current orphan count BEFORE marking new ones so we can
  //    compute how many were cleared by this sync run.
  const [{ preOrphanCount }] = await db
    .select({ preOrphanCount: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.driveSyncOrphan, true));

  // Mark orphans (rows that disappeared from the sheet). Soft-delete only —
  // the leads themselves are NEVER deleted. Admin can review the orphan list.
  for (const o of orphans) {
    // Only flag leads that were previously synced — manually created ones
    // shouldn't be marked as orphans of a sheet they never came from.
    if (o.source !== SYNC_SOURCE && o.source !== "denver_kit_2026") continue;
    await db
      .update(leads)
      .set({ driveSyncOrphan: true, updatedAt: sql`now()` })
      .where(eq(leads.id, o.id));
    report.orphansFlagged++;
  }

  // 9. Count how many previously-orphaned leads are now clear (re-confirmed
  //    or re-inserted this run already cleared their flag in steps 6–7).
  const [{ stillFlagged }] = await db
    .select({ stillFlagged: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.driveSyncOrphan, true));
  report.orphansCleared = Math.max(0, (preOrphanCount ?? 0) - stillFlagged);

  // 10. Update singleton sync state + audit row.
  await markSyncTimestamp();
  await db.insert(auditLog).values({
    actorUserId: operator.id,
    entity: "drive_sync",
    entityId: file.id,
    action: "sync",
    beforeJson: null,
    afterJson: {
      file: report.sourceFile,
      sheetRows: report.sheetRows,
      inserted: report.inserted,
      confirmed: report.confirmed,
      orphansFlagged: report.orphansFlagged,
    },
  });

  return finalize(report, startMs);
}

/* ─── helpers ───────────────────────────────────────────────── */

function finalize(r: DriveSyncReport, startMs: number): DriveSyncReport {
  r.finishedAt = new Date().toISOString();
  r.durationMs = Date.now() - startMs;
  return r;
}

async function findOperatorUser(): Promise<{ id: string } | null> {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(20);
  for (const u of candidates) {
    if (await userHasGoogleConnection(u.id)) return u;
  }
  return null;
}

async function markSyncTimestamp() {
  await db
    .insert(driveSyncState)
    .values({ id: 1, lastSyncAt: sql`now()` })
    .onConflictDoUpdate({
      target: driveSyncState.id,
      set: { lastSyncAt: sql`now()` },
    });
}

