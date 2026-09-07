import { NetworkRequestError } from "./errors";

export async function parseJsonResponse<Result>(response: Response, requestId: string): Promise<Result> {
  try {
    const payload = await response.json() as unknown;
    return unwrapApiEnvelope<Result>(payload, requestId);
  } catch {
    throw new NetworkRequestError({
      code: "INVALID_RESPONSE",
      message: "The service returned an invalid response.",
      requestId,
      status: response.status,
      attempts: 1,
      retryable: false,
    });
  }
}

function unwrapApiEnvelope<Result>(payload: unknown, requestId: string): Result {
  if (!isRecord(payload) || !("data" in payload) || !("error" in payload) || !("meta" in payload)) {
    return payload as Result;
  }
  if (payload.error !== null || payload.data === null) {
    throw new NetworkRequestError({
      attempts: 1,
      code: "INVALID_RESPONSE",
      message: "The service returned an invalid response.",
      requestId,
      retryable: false,
      status: null,
    });
  }
  return payload.data as Result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
