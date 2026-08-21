import { AppState, type AppStateStatus } from "react-native";
import "react-native-url-polyfill/auto";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";

import { createResilientFetch } from "../network/retry";
import type { ProductionAuthConfig } from "./config";
import { createSecureSessionStorage, type AuthSessionStorage } from "./secureStore";

export interface AuthAutoRefreshSubscription {
  remove(): void;
}

export interface AuthAppState {
  addEventListener(
    event: "change",
    listener: (state: AppStateStatus) => void,
  ): AuthAutoRefreshSubscription;
}

export interface SupabaseAuthClientOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly storage?: AuthSessionStorage;
}

export function createSupabaseAuthClient(
  config: ProductionAuthConfig,
  options: SupabaseAuthClientOptions = {},
): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
      persistSession: true,
      storage: options.storage ?? createSecureSessionStorage(),
    },
    global: {
      fetch: createResilientFetch({ fetchImplementation: options.fetchImplementation }),
      headers: { "X-Client-Info": "mf-superior-products-mobile" },
    },
  });
}

export function registerAuthAutoRefresh(
  client: SupabaseClient,
  appState: AuthAppState = AppState,
): () => void {
  const handleStateChange = (state: AppStateStatus) => {
    if (state === "active") {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  };
  handleStateChange(AppState.currentState);
  const subscription = appState.addEventListener("change", handleStateChange);
  return () => {
    subscription.remove();
    client.auth.stopAutoRefresh();
  };
}
