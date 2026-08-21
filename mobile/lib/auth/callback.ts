import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { AuthRuntimeError } from "./errors";

export type AuthCallbackKind = "password-recovery" | "sign-in";

export interface AuthCallback {
  readonly code: string;
  readonly flowId: string | null;
  readonly kind: AuthCallbackKind;
}

export interface ExchangedAuthCallback extends AuthCallback {
  readonly session: Session;
}

export function parseAuthCallbackUrl(callbackUrl: string): AuthCallback {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw invalidCallbackError();
  }

  const parameters = mergeCallbackParameters(url);
  if (parameters.get("error")) {
    throw invalidCallbackError();
  }
  const code = parameters.get("code")?.trim();
  if (!code) {
    throw invalidCallbackError();
  }

  return {
    code,
    flowId: parameters.get("sb_flow_id")?.trim() || null,
    kind: parameters.get("type") === "recovery" ? "password-recovery" : "sign-in",
  };
}

export async function exchangeAuthCallback(
  client: SupabaseClient,
  callbackUrl: string,
): Promise<ExchangedAuthCallback> {
  const callback = parseAuthCallbackUrl(callbackUrl);
  const { data, error } = await client.auth.exchangeCodeForSession(
    callback.code,
    callback.flowId ? { flowId: callback.flowId } : undefined,
  );
  if (error || !data.session) {
    throw new AuthRuntimeError({
      code: "CALLBACK_INVALID",
      message: "This sign-in link is invalid or has expired.",
      retryable: false,
    });
  }
  return { ...callback, session: data.session };
}

function mergeCallbackParameters(url: URL): URLSearchParams {
  const parameters = new URLSearchParams(url.search);
  const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const fragmentParameters = new URLSearchParams(fragment);
  fragmentParameters.forEach((value, key) => {
    if (!parameters.has(key)) {
      parameters.set(key, value);
    }
  });
  return parameters;
}

function invalidCallbackError(): AuthRuntimeError {
  return new AuthRuntimeError({
    code: "CALLBACK_INVALID",
    message: "This sign-in link is invalid or has expired.",
    retryable: false,
  });
}
