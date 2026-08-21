import { auth } from "@/lib/auth";
import type { ZodType, output } from "zod";

const MAX_BODY_BYTES = 64 * 1024;

type CarrierSession = {
  user?: {
    id?: string | null;
    email?: string | null;
  };
} | null;

type SessionLoader = () => Promise<CarrierSession>;

export type CarrierPrincipal = {
  userId: string;
  email: string;
  role: "dispatcher";
};

export type CarrierErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CARRIER_ACCESS_NOT_CONFIGURED"
  | "DISPATCHER_ACCESS_REQUIRED"
  | "INVALID_JSON"
  | "INVALID_QUERY"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

type CarrierError = {
  code: CarrierErrorCode;
  message: string;
  details?: ReadonlyArray<{ path: string; message: string }>;
};

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

type AuthorizationResult =
  | { authorized: true; principal: CarrierPrincipal }
  | { authorized: false; response: Response };

type RateLimitEntry = { count: number; windowStartedAt: number };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const carrierRateLimits = new Map<string, RateLimitEntry>();

function jsonHeaders(): HeadersInit {
  return { "Cache-Control": "private, no-store" };
}

function normalizeAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function consumeRateLimit(key: string, now = Date.now()): boolean {
  const entry = carrierRateLimits.get(key);
  if (!entry || now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    carrierRateLimits.set(key, { count: 1, windowStartedAt: now });
    if (carrierRateLimits.size > 1_000) {
      for (const [candidateKey, candidate] of carrierRateLimits) {
        if (now - candidate.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
          carrierRateLimits.delete(candidateKey);
        }
      }
    }
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

function validationDetails(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
) {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function errorIdentifier(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "unknown";
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "unknown";
}

export function successResponse<T>(
  data: T,
  meta: Record<string, unknown> | null = null,
  status = 200,
): Response {
  return Response.json(
    { data, error: null, meta },
    { status, headers: jsonHeaders() },
  );
}

export function errorResponse(
  status: number,
  error: CarrierError,
): Response {
  return Response.json(
    { data: null, error, meta: null },
    { status, headers: jsonHeaders() },
  );
}

/**
 * Carrier access is deliberately separate from general CRM authentication.
 * Configure a comma-separated CARRIER_DISPATCHER_EMAILS allowlist in the
 * server environment. An absent allowlist fails closed with a 503 response.
 */
export async function requireCarrierDispatcher(
  loadSession: SessionLoader = auth,
  allowlist = process.env.CARRIER_DISPATCHER_EMAILS,
): Promise<AuthorizationResult> {
  let session: CarrierSession;
  try {
    session = await loadSession();
  } catch {
    console.error(JSON.stringify({
      severity: "error",
      event: "carrier_auth_failure",
    }));
    return {
      authorized: false,
      response: errorResponse(503, {
        code: "INTERNAL_ERROR",
        message: "Carrier authentication is temporarily unavailable.",
      }),
    };
  }
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();

  if (!userId || !email) {
    return {
      authorized: false,
      response: errorResponse(401, {
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in to access carrier operations.",
      }),
    };
  }

  const dispatchers = normalizeAllowlist(allowlist);
  if (dispatchers.size === 0) {
    return {
      authorized: false,
      response: errorResponse(503, {
        code: "CARRIER_ACCESS_NOT_CONFIGURED",
        message: "Carrier dispatcher access has not been configured.",
      }),
    };
  }

  if (!dispatchers.has(email)) {
    return {
      authorized: false,
      response: errorResponse(403, {
        code: "DISPATCHER_ACCESS_REQUIRED",
        message: "Dispatcher access is required for carrier operations.",
      }),
    };
  }

  if (!consumeRateLimit(`${userId}:${email}`)) {
    return {
      authorized: false,
      response: errorResponse(429, {
        code: "RATE_LIMITED",
        message: "Too many carrier requests. Wait a minute and try again.",
      }),
    };
  }

  return {
    authorized: true,
    principal: { userId, email, role: "dispatcher" },
  };
}

export function parseQuery<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): ParseResult<output<TSchema>> {
  const values = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(values);
  if (parsed.success) return { success: true, data: parsed.data };

  return {
    success: false,
    response: errorResponse(400, {
      code: "INVALID_QUERY",
      message: "The query parameters are invalid.",
      details: validationDetails(parsed.error.issues),
    }),
  };
}

export async function parseJsonBody<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): Promise<ParseResult<output<TSchema>>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {
      success: false,
      response: errorResponse(415, {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Use an application/json request body.",
      }),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: errorResponse(413, {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the 64 KB limit.",
      }),
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: errorResponse(413, {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the 64 KB limit.",
      }),
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: errorResponse(400, {
        code: "INVALID_JSON",
        message: "The request body must contain valid JSON.",
      }),
    };
  }

  const parsed = schema.safeParse(value);
  if (parsed.success) return { success: true, data: parsed.data };

  return {
    success: false,
    response: errorResponse(400, {
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      details: validationDetails(parsed.error.issues),
    }),
  };
}

export function databaseErrorResponse(error: unknown, operation: string) {
  const databaseCode = errorIdentifier(error);
  const isConflict = databaseCode === "23505" || databaseCode === "23503";

  console.error(
    JSON.stringify({
      severity: "error",
      event: "carrier_api_failure",
      operation,
      databaseCode,
    }),
  );

  if (isConflict) {
    return errorResponse(409, {
      code: "CONFLICT",
      message: "The request conflicts with existing carrier data.",
    });
  }

  return errorResponse(500, {
    code: "INTERNAL_ERROR",
    message: "Carrier operations are temporarily unavailable.",
  });
}
