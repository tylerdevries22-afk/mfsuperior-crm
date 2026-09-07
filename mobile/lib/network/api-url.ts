import { isEncryptedOrLocalUrl } from "../private-network";
import { NetworkRequestError } from "./errors";

export function validateBaseUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (!isEncryptedOrLocalUrl(url)) {
      throw new Error("Unsupported API protocol.");
    }
    return url;
  } catch {
    throw new NetworkRequestError({
      code: "CONFIGURATION",
      message: "The operations service is not configured.",
      requestId: null,
      status: null,
      attempts: 0,
      retryable: false,
    });
  }
}

export function buildApiUrl(baseUrl: URL, path: string): URL {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path) || path.startsWith("//") || path.split("/").includes("..")) {
    throw invalidPathError();
  }
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, ensureTrailingSlash(baseUrl));
}

function invalidPathError(): NetworkRequestError {
  return new NetworkRequestError({
    code: "CONFIGURATION",
    message: "The API request path is invalid.",
    requestId: null,
    status: null,
    attempts: 0,
    retryable: false,
  });
}

function ensureTrailingSlash(url: URL): URL {
  const copy = new URL(url.toString());
  copy.pathname = copy.pathname.endsWith("/") ? copy.pathname : `${copy.pathname}/`;
  return copy;
}

export function safeLogPath(path: string): string {
  return path.split("?")[0] ?? "/";
}
