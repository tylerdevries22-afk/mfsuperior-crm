import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { fetchWithRetry } from "./external-fetch";
import { MobileApiError } from "./http";

export const VEHICLE_THUMBNAIL_BUCKET = "vehicle-thumbnails";
const SIGNED_UPLOAD_LIFETIME_SECONDS = 2 * 60 * 60;
const VEHICLE_THUMBNAIL_READ_LIFETIME_SECONDS = 60 * 60;

export type SignedUpload = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  expiresInSeconds: number;
};

function safeFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  // Path separators are already stripped above, but a name of "." or ".."
  // would still be a relative path segment. Neither is a usable object key,
  // so collapse them rather than reason about how storage normalizes them.
  if (normalized === "." || normalized === "..") return "document";
  return normalized || "document";
}

export function storagePathFor(
  organizationId: string,
  documentId: string,
  fileName: string,
): string {
  return `${organizationId}/${documentId}/${safeFileName(fileName)}`;
}

export function vehicleThumbnailPathFor(
  organizationId: string,
  vehicleId: string,
  fileName: string,
): string {
  return `${organizationId}/vehicles/${vehicleId}/${randomUUID()}-${safeFileName(fileName)}`;
}

export function vehicleThumbnailPathBelongsTo(
  path: string,
  organizationId: string,
  vehicleId: string,
): boolean {
  const prefix = `${organizationId}/vehicles/${vehicleId}/`;
  return path.startsWith(prefix) && path.slice(prefix.length).length > 0 && !path.includes("..");
}

/** Creates a short-lived Supabase Storage upload token using server-only keys. */
export async function signDocumentUpload(path: string): Promise<SignedUpload> {
  const { bucket, client } = storageAdminClient(process.env.SUPABASE_STORAGE_BUCKET);
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "A secure upload URL could not be created.",
    );
  }
  return {
    bucket,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: SIGNED_UPLOAD_LIFETIME_SECONDS,
  };
}

/** Creates a short-lived upload token for the private thumbnail bucket. */
export async function signVehicleThumbnailUpload(path: string): Promise<SignedUpload> {
  const { client } = storageAdminClient(VEHICLE_THUMBNAIL_BUCKET);
  const { data, error } = await client.storage
    .from(VEHICLE_THUMBNAIL_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "A secure vehicle image upload URL could not be created.",
    );
  }
  return {
    bucket: VEHICLE_THUMBNAIL_BUCKET,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: SIGNED_UPLOAD_LIFETIME_SECONDS,
  };
}

/** Creates private, time-limited read URLs without exposing the storage bucket. */
export async function signVehicleThumbnailReads(
  paths: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map();

  const { client } = storageAdminClient(VEHICLE_THUMBNAIL_BUCKET);
  const { data, error } = await client.storage
    .from(VEHICLE_THUMBNAIL_BUCKET)
    .createSignedUrls(uniquePaths, VEHICLE_THUMBNAIL_READ_LIFETIME_SECONDS);
  if (error || !data) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Secure vehicle image URLs could not be created.",
    );
  }

  const signedUrls = new Map<string, string>();
  for (const result of data) {
    if (result.path && result.signedUrl && !result.error) {
      signedUrls.set(result.path, result.signedUrl);
    }
  }
  return signedUrls;
}

export function vehicleThumbnailUploadResponse(signed: SignedUpload) {
  return {
    expiresAt: new Date(Date.now() + signed.expiresInSeconds * 1_000).toISOString(),
    token: signed.token,
    url: signed.signedUrl,
  };
}

function storageAdminClient(bucket: string | undefined) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey || !bucket) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Document storage has not been configured.",
    );
  }

  const requiredBucket = bucket;
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetchWithRetry(input, init, {
          timeoutMs: 8_000,
          maxAttempts: 2,
          retryUnsafe: true,
        }),
    },
  });
  return { bucket: requiredBucket, client };
}
