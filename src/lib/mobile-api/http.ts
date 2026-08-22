import { z, type ZodType } from "zod";

const MAX_BODY_BYTES = 64 * 1024;
const requestIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/);

export type ApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTH_SERVICE_UNAVAILABLE"
  | "AUTH_NOT_CONFIGURED"
  | "MEMBERSHIP_REQUIRED"
  | "ORGANIZATION_REQUIRED"
  | "ROLE_REQUIRED"
  | "MFA_REQUIRED"
  | "TENANT_ACCESS_DENIED"
  | "CSRF_REJECTED"
  | "INVALID_JSON"
  | "INVALID_QUERY"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: ReadonlyArray<{ path: string; message: string }>;
};

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

export function requestIdFor(request: Request): string {
  const candidate = request.headers.get("x-request-id");
  return candidate && requestIdSchema.safeParse(candidate).success
    ? candidate
    : crypto.randomUUID();
}

function responseHeaders(additional?: HeadersInit): Headers {
  const headers = new Headers(additional);
  headers.set("cache-control", "private, no-store");
  return headers;
}

export function apiSuccess<T>(
  data: T,
  requestId: string,
  options: {
    status?: number;
    meta?: Record<string, unknown>;
    headers?: HeadersInit;
  } = {},
): Response {
  return Response.json(
    {
      data,
      error: null,
      meta: { requestId, ...(options.meta ?? {}) },
    },
    {
      status: options.status ?? 200,
      headers: responseHeaders(options.headers),
    },
  );
}

export function apiError(
  status: number,
  error: ApiError,
  requestId: string,
  headers?: HeadersInit,
): Response {
  return Response.json(
    { data: null, error, meta: { requestId } },
    { status, headers: responseHeaders(headers) },
  );
}

function validationDetails(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
) {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

export function parseStrictQuery<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
): ParseResult<T> {
  const values = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(values);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    response: apiError(
      400,
      {
        code: "INVALID_QUERY",
        message: "The query parameters are invalid.",
        details: validationDetails(parsed.error.issues),
      },
      requestId,
    ),
  };
}

export async function parseStrictJson<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
): Promise<ParseResult<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return {
      success: false,
      response: apiError(
        415,
        {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Use an application/json request body.",
        },
        requestId,
      ),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: apiError(
        413,
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body exceeds the 64 KB limit.",
        },
        requestId,
      ),
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: apiError(
        413,
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body exceeds the 64 KB limit.",
        },
        requestId,
      ),
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: apiError(
        400,
        { code: "INVALID_JSON", message: "The body must contain valid JSON." },
        requestId,
      ),
    };
  }

  const parsed = schema.safeParse(value);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    response: apiError(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "The request body is invalid.",
        details: validationDetails(parsed.error.issues),
      },
      requestId,
    ),
  };
}

export function apiFailureResponse(
  error: unknown,
  requestId: string,
  operation: string,
): Response {
  if (error instanceof MobileApiError) {
    return apiError(
      error.status,
      { code: error.code, message: error.message, details: error.details },
      requestId,
    );
  }

  const databaseCode = databaseErrorCode(error);
  console.error(
    JSON.stringify({
      severity: "error",
      event: "mobile_api_failure",
      requestId,
      operation,
      databaseCode,
    }),
  );
  const conflict = databaseCode === "23505" || databaseCode === "23503";
  return apiError(
    conflict ? 409 : 500,
    {
      code: conflict ? "CONFLICT" : "INTERNAL_ERROR",
      message: conflict
        ? "The request conflicts with existing data."
        : "The operation is temporarily unavailable.",
    },
    requestId,
  );
}

/**
 * The SQLSTATE behind a failure, wherever the driver left it.
 *
 * Drizzle wraps driver errors, so the `code` a unique or foreign-key violation
 * carries sits on `error.cause` rather than on the error itself. Reading only
 * the top level reported every constraint violation as "unknown" and answered
 * 500, turning "that unit number is already taken" — which a client can act on —
 * into "the operation is temporarily unavailable", which it cannot.
 */
function databaseErrorCode(error: unknown): string {
  let current = error;
  for (let depth = 0; current !== null && current !== undefined && depth < 5; depth += 1) {
    if (typeof current !== "object") break;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate.code;
    }
    current = candidate.cause;
  }
  return "unknown";
}

export function mergeResponseHeaders(response: Response, headers: Headers): Response {
  const cookieHeaders = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.() ?? [];
  for (const [name, value] of headers.entries()) {
    if (name.toLowerCase() !== "set-cookie") response.headers.append(name, value);
  }
  for (const cookie of cookieHeaders) response.headers.append("set-cookie", cookie);
  return response;
}
