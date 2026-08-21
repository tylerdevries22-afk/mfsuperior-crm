import {
  getFreightPartnerContract,
  type FreightPartnerId,
  type PartnerCapability,
  type PartnerConnectionEvidence,
} from "./contracts";

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,120}$/;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const FORBIDDEN_IDEMPOTENCY_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "proxy-authorization",
]);

export type PartnerEnvironment = "uat" | "production";
export type PartnerHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type PartnerMutationSafety =
  | Readonly<{
      kind: "provider_idempotency";
      key: string;
      headerName?: string;
    }>
  | Readonly<{
      kind: "outcome_reconciliation";
      reconcile: () => Promise<Response | null>;
    }>;

export type PartnerOperationRequest = Readonly<{
  capability: PartnerCapability;
  method: PartnerHttpMethod;
  path: `/${string}`;
  headers?: Readonly<Record<string, string>>;
  body?: string | ArrayBuffer;
  mutationSafety?: PartnerMutationSafety;
}>;

export type PartnerAdapterConfig = Readonly<{
  provider: FreightPartnerId;
  environment: PartnerEnvironment;
  endpointBaseUrl: `https://${string}`;
  connectionEvidence: PartnerConnectionEvidence;
  timeoutMs?: number;
  maxAttempts?: number;
}>;

export type PartnerAdapterEvent = Readonly<{
  provider: FreightPartnerId;
  capability: PartnerCapability;
  environment: PartnerEnvironment;
  event: "attempt" | "retry" | "reconciled" | "completed" | "failed";
  attempt: number;
  status?: number;
}>;

export type PartnerAdapterDependencies = Readonly<{
  fetch?: typeof fetch;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  observe?: (event: PartnerAdapterEvent) => void;
}>;

export type PartnerIntegrationErrorCode =
  | "CONNECTION_NOT_READY"
  | "CAPABILITY_NOT_SUPPORTED"
  | "INVALID_ENDPOINT"
  | "UNSAFE_MUTATION"
  | "DEPENDENCY_UNAVAILABLE";

export class PartnerIntegrationError extends Error {
  constructor(
    readonly code: PartnerIntegrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PartnerIntegrationError";
  }
}

function validateReadiness(config: PartnerAdapterConfig): void {
  const credentialsReady = Boolean(config.connectionEvidence.credentialsVerifiedAt);
  const uatReady = Boolean(config.connectionEvidence.uatApprovedAt);
  const productionReady = Boolean(
    config.connectionEvidence.productionEnabledAt && uatReady,
  );
  if (!credentialsReady || (config.environment === "production" && !productionReady)) {
    throw new PartnerIntegrationError(
      "CONNECTION_NOT_READY",
      config.environment === "production"
        ? "Production traffic requires verified credentials, approved UAT, and an explicit cutover."
        : "UAT traffic requires verified credentials.",
    );
  }
}

function validateCapability(
  provider: FreightPartnerId,
  capability: PartnerCapability,
): void {
  if (!getFreightPartnerContract(provider).capabilities.includes(capability)) {
    throw new PartnerIntegrationError(
      "CAPABILITY_NOT_SUPPORTED",
      "The selected freight partner does not support this operation contract.",
    );
  }
}

function resolveEndpoint(
  baseUrl: `https://${string}`,
  path: `/${string}`,
): URL {
  const base = new URL(baseUrl);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    throw new PartnerIntegrationError("INVALID_ENDPOINT", "The partner path encoding is invalid.");
  }
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    decodedPath.split("/").some((segment) => segment === "." || segment === "..") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("?") ||
    decodedPath.includes("#")
  ) {
    throw new PartnerIntegrationError(
      "INVALID_ENDPOINT",
      "Partner endpoints must be credential-free HTTPS URLs with bounded paths.",
    );
  }
  const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  const resolved = new URL(`${basePath}${path.slice(1)}`, base.origin);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(basePath)) {
    throw new PartnerIntegrationError(
      "INVALID_ENDPOINT",
      "Partner requests cannot leave the configured HTTPS origin.",
    );
  }
  return resolved;
}

function mutationHeaders(
  method: PartnerHttpMethod,
  safety: PartnerMutationSafety | undefined,
): Headers {
  if (!MUTATING_METHODS.has(method)) return new Headers();
  if (!safety) {
    throw new PartnerIntegrationError(
      "UNSAFE_MUTATION",
      "Mutating partner calls require idempotency or outcome reconciliation.",
    );
  }
  if (safety.kind === "outcome_reconciliation") return new Headers();
  const headerName = safety.headerName ?? "Idempotency-Key";
  if (
    !IDEMPOTENCY_KEY_PATTERN.test(safety.key) ||
    !HEADER_NAME_PATTERN.test(headerName) ||
    FORBIDDEN_IDEMPOTENCY_HEADERS.has(headerName.toLowerCase())
  ) {
    throw new PartnerIntegrationError(
      "UNSAFE_MUTATION",
      "The provider idempotency contract is invalid.",
    );
  }
  return new Headers({ [headerName]: safety.key });
}

function requestHeaders(request: PartnerOperationRequest): Headers {
  const headers = new Headers(request.headers);
  const safetyHeaders = mutationHeaders(request.method, request.mutationSafety);
  safetyHeaders.forEach((value, key) => headers.set(key, value));
  headers.delete("host");
  headers.delete("cookie");
  return headers;
}

async function fetchWithTimeout(
  fetchImplementation: typeof fetch,
  url: URL,
  request: PartnerOperationRequest,
  headers: Headers,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("Partner request timed out.")),
    timeoutMs,
  );
  try {
    return await fetchImplementation(url, {
      method: request.method,
      headers,
      body: request.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function reconcileMutation(
  safety: PartnerMutationSafety | undefined,
): Promise<Response | null> {
  if (safety?.kind !== "outcome_reconciliation") return null;
  try {
    return await safety.reconcile();
  } catch {
    throw new PartnerIntegrationError(
      "DEPENDENCY_UNAVAILABLE",
      "The mutation outcome could not be safely reconciled.",
    );
  }
}

function observe(
  dependencies: PartnerAdapterDependencies,
  config: PartnerAdapterConfig,
  request: PartnerOperationRequest,
  event: PartnerAdapterEvent["event"],
  attempt: number,
  status?: number,
): void {
  dependencies.observe?.({
    provider: config.provider,
    capability: request.capability,
    environment: config.environment,
    event,
    attempt,
    status,
  });
}

function retryDelay(attempt: number, random: () => number): number {
  const boundedRandom = Math.min(Math.max(random(), 0), 1);
  return Math.round(150 * 2 ** (attempt - 1) * (0.75 + boundedRandom * 0.5));
}

function normalizedConfig(config: PartnerAdapterConfig): {
  timeoutMs: number;
  maxAttempts: number;
} {
  return {
    timeoutMs: Math.min(Math.max(config.timeoutMs ?? 10_000, 250), 60_000),
    maxAttempts: Math.min(Math.max(config.maxAttempts ?? 2, 2), 4),
  };
}

/** Executes an onboarding-gated partner operation with bounded, safe retries. */
export async function executePartnerOperation(
  config: PartnerAdapterConfig,
  request: PartnerOperationRequest,
  dependencies: PartnerAdapterDependencies = {},
): Promise<Response> {
  validateReadiness(config);
  validateCapability(config.provider, request.capability);
  const url = resolveEndpoint(config.endpointBaseUrl, request.path);
  const headers = requestHeaders(request);
  const limits = normalizedConfig(config);
  const fetchImplementation = dependencies.fetch ?? fetch;
  const random = dependencies.random ?? Math.random;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= limits.maxAttempts; attempt += 1) {
    observe(dependencies, config, request, "attempt", attempt);
    try {
      const response = await fetchWithTimeout(
        fetchImplementation,
        url,
        request,
        headers,
        limits.timeoutMs,
      );
      if (!TRANSIENT_STATUS_CODES.has(response.status)) {
        observe(dependencies, config, request, "completed", attempt, response.status);
        return response;
      }
      await response.body?.cancel();
      lastError = new Error("Transient freight partner response.");
      if (attempt === limits.maxAttempts) break;
    } catch (error) {
      lastError = error;
      if (attempt === limits.maxAttempts) break;
    }

    const reconciled = await reconcileMutation(request.mutationSafety);
    if (reconciled) {
      observe(dependencies, config, request, "reconciled", attempt, reconciled.status);
      return reconciled;
    }
    observe(dependencies, config, request, "retry", attempt);
    await sleep(retryDelay(attempt, random));
  }

  observe(dependencies, config, request, "failed", limits.maxAttempts);
  throw new PartnerIntegrationError(
    "DEPENDENCY_UNAVAILABLE",
    lastError instanceof Error
      ? "The freight partner did not respond within the bounded retry policy."
      : "The freight partner request failed.",
  );
}
