import {
  ApiMembershipSyncGateway,
  createSecureSessionStorage,
  createSupabaseAuthClient,
  resolveAuthRuntimeConfig,
  SupabaseAuthService,
  type AuthRuntimeConfig,
  type ProductionAuthConfig,
} from "@/lib/auth";
import { ApiClient } from "@/lib/network";

let cachedService: SupabaseAuthService | null | undefined;

/** Return the shared production auth service, or null for demo/unconfigured builds. */
export function getProductionAuthService(): SupabaseAuthService | null {
  if (cachedService !== undefined) return cachedService;
  const runtime = resolveAuthRuntimeConfig();
  cachedService = runtime.mode === "production" ? createProductionAuthService(runtime.config) : null;
  return cachedService;
}

function createProductionAuthService(config: ProductionAuthConfig): SupabaseAuthService {
  const client = createSupabaseAuthClient(config, { storage: createSecureSessionStorage() });
  const service: SupabaseAuthService = new SupabaseAuthService(
    client,
    null,
    new ApiMembershipSyncGateway({
      apiClient: new ApiClient({
        baseUrl: config.authApiBaseUrl,
        getAccessToken: () => service.getAccessToken(),
      }),
    }),
  );
  return service;
}

/** Expose the current public auth mode without leaking configuration values. */
export function getAuthRuntimeMode(): AuthRuntimeConfig["mode"] {
  return resolveAuthRuntimeConfig().mode;
}

/** Test-only reset for the module singleton. */
export function resetProductionAuthServiceForTests(): void {
  cachedService = undefined;
}
