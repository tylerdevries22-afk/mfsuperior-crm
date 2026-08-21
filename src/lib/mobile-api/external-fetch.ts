export type RetryFetchOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  retryUnsafe?: boolean;
};

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

function canRetry(
  init: RequestInit | undefined,
  retryUnsafe: boolean,
): boolean {
  if (retryUnsafe) return true;
  const method = (init?.method ?? "GET").toUpperCase();
  if (IDEMPOTENT_METHODS.has(method)) return true;
  return new Headers(init?.headers).has("idempotency-key");
}

function combinedAbortSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abort);
    },
  };
}

/** Fetches with a mandatory timeout and at least one retry when safe. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryFetchOptions = {},
): Promise<Response> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 250), 60_000);
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 2, 2), 4);
  const retryDelayMs = Math.min(Math.max(options.retryDelayMs ?? 100, 0), 2_000);
  const retryable = canRetry(init, options.retryUnsafe ?? false);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abort = combinedAbortSignal(init?.signal, timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: abort.signal });
      if (
        attempt === maxAttempts ||
        !retryable ||
        !TRANSIENT_STATUSES.has(response.status)
      ) {
        return response;
      }
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !retryable || init?.signal?.aborted) {
        throw error;
      }
    } finally {
      abort.dispose();
    }

    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("External request failed without a response.");
}
