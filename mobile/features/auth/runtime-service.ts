import {
  createSecureSessionStorage,
  createSupabaseAuthClient,
  resolveAuthRuntimeConfig,
  SupabaseAuthService,
  type AuthRuntimeConfig,
} from "@/lib/auth";

let cachedService: SupabaseAuthService | null | undefined;

/** Return the shared production auth service, or null for demo/unconfigured builds. */
export function getProductionAuthService(): SupabaseAuthService | null {
  if (cachedService !== undefined) return cachedService;
  const runtime = resolveAuthRuntimeConfig();
  cachedService = runtime.mode === "production"
    ? new SupabaseAuthService(createSupabaseAuthClient(runtime.config, { storage: createSecureSessionStorage() }))
    : null;
  return cachedService;
}

/** Expose the current public auth mode without leaking configuration values. */
export function getAuthRuntimeMode(): AuthRuntimeConfig["mode"] {
  return resolveAuthRuntimeConfig().mode;
}

/** Test-only reset for the module singleton. */
export function resetProductionAuthServiceForTests(): void {
  cachedService = undefined;
}
