import { createClient } from "@supabase/supabase-js";
import { fetchWithRetry } from "./external-fetch";
import { MobileApiError } from "./http";

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

/** Creates a short-lived Supabase Storage upload token using server-only keys. */
export async function signDocumentUpload(path: string): Promise<SignedUpload> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceRoleKey || !bucket) {
    throw new MobileApiError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Document storage has not been configured.",
    );
  }

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
    expiresInSeconds: 120,
  };
}
