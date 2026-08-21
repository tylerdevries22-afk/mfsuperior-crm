import { NetworkRequestError } from "./errors";

export const NETWORK_TIMEOUT_MS = 10_000;
export const NETWORK_MAX_ATTEMPTS = 2;

export interface ResilientFetchOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly random?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly timeoutMs?: number;
}

export function computeRetryDelayMs(
  failedAttempt: number,
  randomValue: number,
  baseDelayMs = 250,
): number {
  const normalizedAttempt = Math.max(1, Math.floor(failedAttempt));
  const normalizedRandom = Math.min(1, Math.max(0, randomValue));
  const exponentialDelay = baseDelayMs * (2 ** (normalizedAttempt - 1));
  return Math.round(exponentialDelay + normalizedRandom * baseDelayMs);
}

export function createResilientFetch(options: ResilientFetchOptions = {}): typeof fetch {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? NETWORK_TIMEOUT_MS;

  return async (input, init) => {
    let lastFailure: unknown = null;
    for (let attempt = 1; attempt <= NETWORK_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchAttempt(fetchImplementation, input, init, timeoutMs);
        if (!isRetryableStatus(response.status) || attempt === NETWORK_MAX_ATTEMPTS) {
          return response;
        }
        lastFailure = response;
      } catch (error: unknown) {
        if (isExternalAbort(error, init?.signal) || attempt === NETWORK_MAX_ATTEMPTS) {
          throw error;
        }
        lastFailure = error;
      }
      await sleep(computeRetryDelayMs(attempt, random()));
    }

    throw lastFailure ?? new NetworkRequestError({
      code: "NETWORK_UNAVAILABLE",
      message: "The service could not be reached. Please try again.",
      requestId: null,
      status: null,
      attempts: NETWORK_MAX_ATTEMPTS,
      retryable: true,
    });
  };
}

async function fetchAttempt(
  fetchImplementation: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const detachExternalAbort = forwardAbort(init?.signal, controller);
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetchImplementation(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    detachExternalAbort();
  }
}

function forwardAbort(signal: AbortSignal | null | undefined, controller: AbortController): () => void {
  if (!signal) {
    return () => undefined;
  }
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) {
    abort();
    return () => undefined;
  }
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

function isExternalAbort(error: unknown, signal: AbortSignal | null | undefined): boolean {
  return Boolean(signal?.aborted) || (
    error instanceof Error && error.name === "AbortError" && signal?.aborted === true
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
