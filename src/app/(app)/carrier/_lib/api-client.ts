type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
};

type ApiEnvelope<T> = {
  data: T;
  error: ApiErrorBody | null;
};

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return isRecord(value) && "data" in value && "error" in value;
}

function errorDetails(value: unknown) {
  if (!isRecord(value)) return { code: "INVALID_RESPONSE", message: null };
  const code = typeof value.code === "string" ? value.code : "API_ERROR";
  const message = typeof value.message === "string" ? value.message : null;
  return { code, message };
}

async function requestOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export class CarrierApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CarrierApiError";
  }
}

export async function fetchCarrierData<T>(url: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await requestOnce(url);
      const value = (await response.json()) as unknown;
      if (!isEnvelope<T>(value)) {
        throw new CarrierApiError(
          "Carrier services returned an invalid response.",
          "INVALID_RESPONSE",
          response.status,
        );
      }
      if (!response.ok || value.error) {
        const details = errorDetails(value.error);
        throw new CarrierApiError(
          details.message ?? "Carrier services are unavailable.",
          details.code,
          response.status,
        );
      }
      return value.data;
    } catch (error) {
      lastError = error;
      const status = error instanceof CarrierApiError ? error.status : 0;
      const retryable = status === 0 || status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
    }
  }

  if (lastError instanceof CarrierApiError) throw lastError;
  throw new CarrierApiError(
    "Carrier services did not respond in time.",
    "REQUEST_FAILED",
    0,
  );
}
