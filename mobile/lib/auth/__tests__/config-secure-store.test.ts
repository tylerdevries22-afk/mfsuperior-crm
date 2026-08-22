import { describe, expect, it } from "@jest/globals";

import { resolveAuthRuntimeConfig } from "../config";
import {
  ChunkedSecureStoreAdapter,
  createSecureSessionStorage,
  type SecureStoreBackend,
} from "../secureStore";

class MemorySecureStore implements SecureStoreBackend {
  readonly values = new Map<string, string>();

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe("auth configuration", () => {
  it("requires an explicit demo flag and validates production public configuration", () => {
    expect(resolveAuthRuntimeConfig({ EXPO_PUBLIC_DEMO_AUTH_ENABLED: "true" })).toEqual({
      mode: "demo",
    });
    expect(resolveAuthRuntimeConfig({ EXPO_PUBLIC_DEMO_AUTH_ENABLED: "TRUE" }).mode).toBe(
      "unconfigured",
    );

    expect(resolveAuthRuntimeConfig({
      EXPO_PUBLIC_API_BASE_URL: "https://api.example.com/api/mobile",
      EXPO_PUBLIC_MOBILE_PARITY_V2: "true",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    })).toEqual({
      config: {
        apiBaseUrl: "https://api.example.com/api/mobile",
        authApiBaseUrl: "https://api.example.com/api/auth",
        redirectScheme: "mfsuperior",
        supabasePublishableKey: "sb_publishable_test",
        supabaseUrl: "https://project.supabase.co",
      },
      mode: "production",
    });
    expect(resolveAuthRuntimeConfig({
      EXPO_PUBLIC_API_BASE_URL: "http://public.example.com/api/mobile",
      EXPO_PUBLIC_MOBILE_PARITY_V2: "true",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    }).mode).toBe("unconfigured");
    expect(resolveAuthRuntimeConfig({
      EXPO_PUBLIC_API_BASE_URL: "https://api.example.com/api/mobile",
      EXPO_PUBLIC_MOBILE_PARITY_V2: "false",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    })).toEqual({
      missing: ["EXPO_PUBLIC_MOBILE_PARITY_V2=true"],
      mode: "unconfigured",
    });
  });
});

describe("ChunkedSecureStoreAdapter", () => {
  it("atomically chunks, replaces, reads, and removes large sessions", async () => {
    const backend = new MemorySecureStore();
    let generation = 0;
    const storage = new ChunkedSecureStoreAdapter(backend, {
      chunkSize: 256,
      generationIdFactory: () => `generation-${generation += 1}`,
      namespace: "test.auth",
    });
    const first = "a".repeat(700);
    const second = "b".repeat(300);

    await storage.setItem("supabase/session", first);
    expect(await storage.getItem("supabase/session")).toBe(first);
    await storage.setItem("supabase/session", second);
    expect(await storage.getItem("supabase/session")).toBe(second);
    expect([...backend.values.keys()].some((key) => key.includes("generation-1"))).toBe(false);

    await storage.removeItem("supabase/session");
    expect(await storage.getItem("supabase/session")).toBeNull();
  });

  it("returns null for an incomplete manifest without exposing partial session data", async () => {
    const backend = new MemorySecureStore();
    const storage = new ChunkedSecureStoreAdapter(backend, {
      generationIdFactory: () => "generation",
      namespace: "test.auth",
    });
    await storage.setItem("key", "session");
    const chunkKey = [...backend.values.keys()].find((key) => key.endsWith(".generation.0"));
    expect(chunkKey).toBeDefined();
    if (chunkKey) {
      backend.values.delete(chunkKey);
    }
    expect(await storage.getItem("key")).toBeNull();
    expect(createSecureSessionStorage()).toBeDefined();
  });
});
