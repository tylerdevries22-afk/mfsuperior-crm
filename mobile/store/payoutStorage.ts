import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { OperationsDomainError } from "../domain/errors";
import { resolveAuthRuntimeConfig } from "../lib/auth/config";
import { ChunkedSecureStoreAdapter, type AuthSessionStorage } from "../lib/auth/secureStore";

const browserDemoHandles = new Map<string, string>();

export function createPayoutSecureStorage(): AuthSessionStorage {
  if (Platform.OS === "web") {
    // Demo handles are synthetic and last only for this browser session.
    // Production handles remain restricted to the device keychain.
    const requireDemo = () => {
      if (resolveAuthRuntimeConfig().mode !== "demo") {
        throw new OperationsDomainError("VALIDATION_FAILED", "Manage payout handles in the mobile app.");
      }
    };
    return {
      getItem: async (key) => { requireDemo(); return browserDemoHandles.get(key) ?? null; },
      setItem: async (key, value) => { requireDemo(); browserDemoHandles.set(key, value); },
      removeItem: async (key) => { requireDemo(); browserDemoHandles.delete(key); },
    };
  }
  return new ChunkedSecureStoreAdapter({
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  }, { namespace: "mfsp.payout.v1" });
}
