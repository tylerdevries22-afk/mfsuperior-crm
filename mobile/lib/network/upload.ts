import { NetworkRequestError } from "./errors";
import { createResilientFetch } from "./retry";

/** Signed upload target returned by `POST /v1/documents/upload-intent`. */
export interface SignedUploadTarget {
  readonly contentType: string;
  readonly expiresAt: string;
  readonly token: string;
  readonly url: string;
}

export interface UploadIntentResponse {
  readonly documentId: string;
  readonly upload: SignedUploadTarget;
}

export interface UploadSource {
  readonly base64?: string;
  readonly uri?: string;
}

export interface UploadBody {
  readonly body: Blob;
  readonly byteSize: number;
}

export interface UploadTransportOptions {
  readonly baseUrl?: string;
  readonly fetchImplementation?: typeof fetch;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Reads a retained `file://` URI or an inline base64 payload into bytes. */
export async function readUploadBody(
  source: UploadSource,
  fetchImplementation: typeof fetch = fetch,
): Promise<UploadBody> {
  if (source.uri) {
    const response = await fetchImplementation(source.uri);
    const blob = await response.blob();
    return { body: blob, byteSize: blob.size };
  }
  if (source.base64) {
    const bytes = decodeBase64(stripDataUrlPrefix(source.base64));
    return { body: new Blob([bytes]), byteSize: bytes.length };
  }
  throw new NetworkRequestError({
    attempts: 0,
    code: "CONFIGURATION",
    message: "The pending file is no longer available on this device.",
    requestId: null,
    retryable: false,
    status: null,
  });
}

/** PUTs the bytes to the signed Supabase Storage upload URL. */
export async function uploadToSignedUrl(
  target: SignedUploadTarget,
  upload: UploadBody,
  options: UploadTransportOptions = {},
): Promise<void> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const url = resolveUploadUrl(target, options.baseUrl);
  const response = await createResilientFetch({
    fetchImplementation,
    timeoutMs: 10_000,
  })(url, {
    body: upload.body,
    headers: { "Content-Type": target.contentType },
    method: "PUT",
  });
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 425 ||
      response.status === 429 || response.status >= 500;
    throw new NetworkRequestError({
      attempts: 1,
      code: "HTTP_ERROR",
      message: "The document upload could not be completed.",
      requestId: null,
      retryable,
      status: response.status,
    });
  }
}

function resolveUploadUrl(target: SignedUploadTarget, baseUrl: string | undefined): string {
  let url: URL;
  try {
    url = new URL(target.url);
  } catch {
    if (!baseUrl) {
      throw new NetworkRequestError({
        attempts: 0,
        code: "CONFIGURATION",
        message: "The upload service is not configured.",
        requestId: null,
        retryable: false,
        status: null,
      });
    }
    url = new URL(target.url, baseUrl);
  }
  if (!url.searchParams.has("token")) {
    url.searchParams.set("token", target.token);
  }
  return url.toString();
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  return value.startsWith("data:") && commaIndex >= 0
    ? value.slice(commaIndex + 1)
    : value;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const clean = value.replace(/\s+/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    if (character === "=") break;
    const digit = BASE64_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new NetworkRequestError({
        attempts: 0,
        code: "INVALID_RESPONSE",
        message: "The captured signature data is invalid.",
        requestId: null,
        retryable: false,
        status: null,
      });
    }
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}
