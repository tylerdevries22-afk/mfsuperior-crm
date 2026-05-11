import ExcelJS from "exceljs";
import { google } from "googleapis";
import { Readable } from "node:stream";
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { getGoogleAccessToken } from "@/lib/gmail/oauth";
import { ProviderAuthError } from "@/lib/email/provider";
import { XLSX_MIME } from "@/lib/drive/client";

/**
 * Drive PUSH — exports the current `leads` table to a single canonical
 * spreadsheet inside the configured Drive folder. Uses the same column
 * shape as the importer (`lib/xlsx.ts`) so a round trip (push → pull) is
 * idempotent.
 *
 * The push uses a fixed filename so it overwrites itself; if it doesn't
 * exist yet the function creates it. We never delete, only update.
 */

export const EXPORT_FILE_NAME = "MFS_Leads_Synced.xlsx";

export type DriveExportReport = {
  exported: number;
  fileId: string;
  fileName: string;
  created: boolean;
};

function rethrow(err: unknown): never {
  const e = err as { code?: number; status?: number; message?: string };
  if (
    e.code === 401 ||
    e.status === 401 ||
    e.code === 403 ||
    e.status === 403
  ) {
    throw new ProviderAuthError(
      e.message ?? "Drive token expired or insufficient scope",
    );
  }
  throw err;
}

/** Build an xlsx buffer with the canonical column order. */
async function buildLeadsWorkbook(): Promise<{
  buffer: Buffer;
  rowCount: number;
}> {
  const rows = await db
    .select({
      companyName: leads.companyName,
      tier: leads.tier,
      score: leads.score,
      vertical: leads.vertical,
      address: leads.address,
      city: leads.city,
      state: leads.state,
      phone: leads.phone,
      website: leads.website,
      email: leads.email,
      stage: leads.stage,
      status: leads.status,
      tags: leads.tags,
      notes: leads.notes,
      lastContactedAt: leads.lastContactedAt,
      nextFollowUpAt: leads.nextFollowUpAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(isNull(leads.archivedAt));

  const wb = new ExcelJS.Workbook();
  wb.creator = "MF Superior Products CRM";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Leads");

  // Header order matches HEADER_ALIASES in xlsx.ts so a round trip parses.
  sheet.addRow([
    "Company",
    "Tier",
    "Score",
    "Vertical",
    "Address",
    "City",
    "State",
    "Phone",
    "Website",
    "Email",
    "Stage",
    "Status",
    "Tags",
    "Notes",
    "Last Contacted",
    "Next Follow-Up",
    "Created",
    "Updated",
  ]);
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow([
      r.companyName,
      r.tier ?? "",
      r.score ?? "",
      r.vertical ?? "",
      r.address ?? "",
      r.city ?? "",
      r.state ?? "",
      r.phone ?? "",
      r.website ?? "",
      r.email ?? "",
      r.stage,
      r.status,
      r.tags?.join(", ") ?? "",
      r.notes ?? "",
      r.lastContactedAt
        ? new Date(r.lastContactedAt).toISOString().slice(0, 10)
        : "",
      r.nextFollowUpAt
        ? new Date(r.nextFollowUpAt).toISOString().slice(0, 10)
        : "",
      new Date(r.createdAt).toISOString().slice(0, 10),
      new Date(r.updatedAt).toISOString().slice(0, 10),
    ]);
  }

  // Reasonable column widths so the sheet is readable on first open.
  const widths = [28, 6, 6, 18, 32, 14, 6, 16, 28, 28, 12, 10, 18, 40, 14, 14, 12, 12];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ExcelJS returns ArrayBuffer-like; coerce to a Node Buffer for the upload.
  const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return { buffer: Buffer.from(ab), rowCount: rows.length };
}

/**
 * Push: write the current leads table to a single canonical file in the
 * configured Drive folder. Replaces the file if it exists, creates it
 * otherwise.
 */
export async function exportLeadsToDrive(
  userId: string,
  folderId: string,
): Promise<DriveExportReport> {
  const accessToken = await getGoogleAccessToken(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth });

  const { buffer, rowCount } = await buildLeadsWorkbook();
  const body = Readable.from(buffer);
  const exported = rowCount;

  // Look for an existing canonical file by name + parent.
  const safeFolder = folderId.replace(/'/g, "\\'");
  const safeName = EXPORT_FILE_NAME.replace(/'/g, "\\'");
  let existingId: string | null = null;
  try {
    const res = await drive.files.list({
      q: [
        `'${safeFolder}' in parents`,
        `name='${safeName}'`,
        "trashed=false",
      ].join(" and "),
      fields: "files(id,name)",
      pageSize: 5,
      supportsAllDrives: false,
    });
    existingId = res.data.files?.[0]?.id ?? null;
  } catch (err) {
    rethrow(err);
  }

  if (existingId) {
    try {
      await drive.files.update({
        fileId: existingId,
        media: { mimeType: XLSX_MIME, body },
        supportsAllDrives: false,
      });
    } catch (err) {
      rethrow(err);
    }
    return {
      exported,
      fileId: existingId,
      fileName: EXPORT_FILE_NAME,
      created: false,
    };
  }

  let created;
  try {
    created = await drive.files.create({
      requestBody: {
        name: EXPORT_FILE_NAME,
        mimeType: XLSX_MIME,
        parents: [folderId],
      },
      media: { mimeType: XLSX_MIME, body },
      fields: "id,name",
      supportsAllDrives: false,
    });
  } catch (err) {
    rethrow(err);
  }

  return {
    exported,
    fileId: created.data.id ?? "",
    fileName: created.data.name ?? EXPORT_FILE_NAME,
    created: true,
  };
}
