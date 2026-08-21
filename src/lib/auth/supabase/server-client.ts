import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWithRetry } from "@/lib/mobile-api/external-fetch";
import {
  readSupabasePublicConfig,
  type SupabasePublicConfig,
} from "./config";

export type RequestSupabaseClient = {
  client: SupabaseClient;
  responseHeaders: Headers;
};

/** Creates one SSR client per request using the current getAll/setAll API. */
export function createRequestSupabaseClient(
  request: Request,
  config: SupabasePublicConfig | null = readSupabasePublicConfig(),
): RequestSupabaseClient | null {
  if (!config) return null;

  const responseHeaders = new Headers();
  const client = createServerClient(config.url, config.publishableKey, {
    auth: { flowType: "pkce" },
    global: {
      fetch: (input, init) =>
        fetchWithRetry(input, init, {
          timeoutMs: 8_000,
          maxAttempts: 2,
        }),
    },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "");
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const [name, value] of Object.entries(cacheHeaders)) {
          responseHeaders.set(name, value);
        }
        for (const cookie of cookiesToSet) {
          responseHeaders.append(
            "set-cookie",
            serializeCookieHeader(cookie.name, cookie.value, cookie.options),
          );
        }
      },
    },
  });

  return { client, responseHeaders };
}
