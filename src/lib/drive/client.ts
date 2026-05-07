import { google, type drive_v3 } from "googleapis";
import { getGoogleAccessToken } from "@/lib/gmail/oauth";
import { ProviderAuthError } from "@/lib/email/provider";

/**
 * Google Drive client wrapper, scoped to the same OAuth user as Gmail.
 *
 * Scope on the OAuth client is `drive.file` — Drive only exposes files this
 * app has created or that the user has explicitly opened with this app
 * (which includes anything in a folder the user has shared with the app).
 * That's the right blast-radius: the app can't see the user's whole Drive.
 */

export type DriveFileRef = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: number;
};

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  const accessToken = await getGoogleAccessToken(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

/** Translate googleapis 401/403 into ProviderAuthError so callers can handle it uniformly. */
function rethrow(err: unknown): never {
  const e = err as { code?: number; status?: number; message?: string };
  if (e.code === 401 || e.status === 401 || e.code === 403 || e.status === 403) {
    throw new ProviderAuthError(e.message ?? "Drive token expired or insufficient scope");
  }
  throw err;
}

/**
 * Find candidate lead-list spreadsheets inside a configured folder.
 * Returns matches ordered by modifiedTime descending — the caller picks
 * the freshest one.
 */
export async function listLeadSpreadsheets(
  userId: string,
  folderId: string,
): Promise<DriveFileRef[]> {
  const drive = await getDriveClient(userId);

  // Drive's q syntax: parent folder + xlsx mime + name pattern.
  const safeFolder = folderId.replace(/'/g, "\\'");
  const q = [
    `'${safeFolder}' in parents`,
    `mimeType='${XLSX_MIME}'`,
    "trashed=false",
    `(name contains 'Lead' or name contains 'lead')`,
  ].join(" and ");

  let res;
  try {
    res = await drive.files.list({
      q,
      fields: "files(id,name,mimeType,modifiedTime,size)",
      orderBy: "modifiedTime desc",
      pageSize: 25,
      supportsAllDrives: false,
    });
  } catch (err) {
    rethrow(err);
  }

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? "",
    size: Number(f.size ?? 0),
  }));
}

/** Stream a Drive file's binary content into an ArrayBuffer for parsing. */
export async function downloadFileBytes(
  userId: string,
  fileId: string,
): Promise<ArrayBuffer> {
  const drive = await getDriveClient(userId);
  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    // googleapis returns the body as ArrayBuffer when responseType is set; the
    // type is `unknown` because the SDK can't narrow on the option. Trust it.
    return res.data as ArrayBuffer;
  } catch (err) {
    rethrow(err);
  }
}
