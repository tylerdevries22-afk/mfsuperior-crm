import { isPrivateNetworkHost } from "../private-network";

export interface ProductionAuthConfig {
  readonly apiBaseUrl: string;
  /** Origin-scoped base for the server membership endpoints (`/api/auth/`). */
  readonly authApiBaseUrl: string;
  readonly redirectScheme: "mfsuperior";
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
}

export type AuthRuntimeConfig =
  | { readonly mode: "demo" }
  | { readonly config: ProductionAuthConfig; readonly mode: "production" }
  | { readonly missing: readonly string[]; readonly mode: "unconfigured" };

export type PublicEnvironment = Readonly<Record<string, string | undefined>>;

const REQUIRED_PRODUCTION_KEYS = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_MOBILE_PARITY_V2",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_SUPABASE_URL",
] as const;

export function resolveAuthRuntimeConfig(
  environment: PublicEnvironment = process.env,
): AuthRuntimeConfig {
  if (environment.EXPO_PUBLIC_DEMO_AUTH_ENABLED === "true") {
    return { mode: "demo" };
  }

  const missing = REQUIRED_PRODUCTION_KEYS.filter((key) => !environment[key]?.trim());
  if (missing.length > 0) {
    return { missing, mode: "unconfigured" };
  }
  if (environment.EXPO_PUBLIC_MOBILE_PARITY_V2 !== "true") {
    return { missing: ["EXPO_PUBLIC_MOBILE_PARITY_V2=true"], mode: "unconfigured" };
  }

  const supabaseUrl = requireSecurePublicUrl(environment.EXPO_PUBLIC_SUPABASE_URL);
  const apiBaseUrl = requireMobileApiBaseUrl(environment.EXPO_PUBLIC_API_BASE_URL);
  const supabasePublishableKey = environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !apiBaseUrl || !supabasePublishableKey) {
    return { missing: ["valid HTTPS production URLs"], mode: "unconfigured" };
  }

  return {
    config: {
      apiBaseUrl,
      authApiBaseUrl: authApiBaseUrlFor(apiBaseUrl),
      redirectScheme: "mfsuperior",
      supabasePublishableKey,
      supabaseUrl,
    },
    mode: "production",
  };
}

/**
 * `/api/auth/sync` is the membership source of truth and lives outside the
 * `/api/mobile` prefix, so it is derived from the validated API origin.
 */
function authApiBaseUrlFor(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  url.pathname = "/api/auth/";
  return url.toString().replace(/\/$/, "");
}

function requireSecurePublicUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value?.trim() ?? "");
    if (url.protocol !== "https:" && !isLocalDevelopmentHost(url.hostname)) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function requireMobileApiBaseUrl(value: string | undefined): string | null {
  const secureUrl = requireSecurePublicUrl(value);
  if (!secureUrl) return null;
  const url = new URL(secureUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  if (normalizedPath !== "/api/mobile") return null;
  url.pathname = "/api/mobile/";
  return url.toString().replace(/\/$/, "");
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return isPrivateNetworkHost(hostname);
}
