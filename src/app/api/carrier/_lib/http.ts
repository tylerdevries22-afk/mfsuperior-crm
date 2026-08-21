import type { ZodType } from "zod";
import {
  authorizeMobileRequest,
  type AuthorizationResult,
  type MobilePrincipal,
} from "@/lib/mobile-api/authorize";
import {
  apiError,
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  parseStrictJson,
  parseStrictQuery,
  requestIdFor,
  type ApiError,
  type ParseResult,
} from "@/lib/mobile-api/http";

export type CarrierPrincipal = MobilePrincipal & {
  role: "admin";
  carrierId: string;
};

export type CarrierAuthorizationResult =
  | (Omit<Extract<AuthorizationResult, { authorized: true }>, "principal"> & {
      principal: CarrierPrincipal;
    })
  | Extract<AuthorizationResult, { authorized: false }>;

export async function requireCarrierAdmin(
  request: Request,
): Promise<CarrierAuthorizationResult> {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin"],
    requireCarrier: true,
    rateLimit: { scope: "carrier", limit: 60, windowMs: 60_000 },
  });
  return authorization as CarrierAuthorizationResult;
}

export function successResponse<T>(
  data: T,
  requestId: string,
  meta: Record<string, unknown> | null = null,
  status = 200,
  headers?: HeadersInit,
): Response {
  return apiSuccess(data, requestId, {
    status,
    meta: meta ?? undefined,
    headers,
  });
}

export function errorResponse(
  status: number,
  error: ApiError,
  requestId: string,
  headers?: HeadersInit,
): Response {
  return apiError(status, error, requestId, headers);
}

export function parseQuery<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
): ParseResult<T> {
  return parseStrictQuery(request, schema, requestId);
}

export function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
): Promise<ParseResult<T>> {
  return parseStrictJson(request, schema, requestId);
}

export function databaseErrorResponse(
  error: unknown,
  operation: string,
  requestId: string,
): Response {
  return apiFailureResponse(error, requestId, operation);
}

export function withCarrierAuthHeaders(
  response: Response,
  authorization: Extract<CarrierAuthorizationResult, { authorized: true }>,
): Response {
  return mergeResponseHeaders(response, authorization.responseHeaders);
}

export { requestIdFor };
