import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export const SECURE_STORE_CHUNK_SIZE = 1_800;

interface SecureStoreManifest {
  readonly chunks: number;
  readonly generation: string;
  readonly version: 1;
}

export interface SecureStoreBackend {
  deleteItemAsync(key: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface ChunkedSecureStoreOptions {
  readonly chunkSize?: number;
  readonly generationIdFactory?: () => string;
  readonly namespace?: string;
}

export interface AuthSessionStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

export class ChunkedSecureStoreAdapter implements AuthSessionStorage {
  private operation: Promise<void> = Promise.resolve();
  private readonly chunkSize: number;
  private readonly generationIdFactory: () => string;
  private readonly namespace: string;

  constructor(
    private readonly backend: SecureStoreBackend,
    options: ChunkedSecureStoreOptions = {},
  ) {
    this.chunkSize = Math.max(256, options.chunkSize ?? SECURE_STORE_CHUNK_SIZE);
    this.generationIdFactory = options.generationIdFactory ?? Crypto.randomUUID;
    this.namespace = options.namespace ?? "mfsp.auth.v1";
  }

  async getItem(key: string): Promise<string | null> {
    return this.runExclusive(async () => {
      const manifest = await this.readManifest(key);
      if (!manifest) {
        return null;
      }
      const chunks = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) => (
          this.backend.getItemAsync(this.chunkKey(key, manifest.generation, index))
        )),
      );
      return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join("") : null;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.runExclusive(async () => {
      const previousManifest = await this.readManifest(key);
      const generation = this.generationIdFactory();
      const chunks = splitValue(value, this.chunkSize);
      try {
        await Promise.all(chunks.map((chunk, index) => (
          this.backend.setItemAsync(this.chunkKey(key, generation, index), chunk)
        )));
        await this.backend.setItemAsync(
          this.manifestKey(key),
          JSON.stringify({ chunks: chunks.length, generation, version: 1 }),
        );
      } catch (error: unknown) {
        await this.deleteChunks(key, generation, chunks.length);
        throw error;
      }
      if (previousManifest) {
        await this.deleteChunks(key, previousManifest.generation, previousManifest.chunks);
      }
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.runExclusive(async () => {
      const manifest = await this.readManifest(key);
      await this.backend.deleteItemAsync(this.manifestKey(key));
      if (manifest) {
        await this.deleteChunks(key, manifest.generation, manifest.chunks);
      }
    });
  }

  private async readManifest(key: string): Promise<SecureStoreManifest | null> {
    const serialized = await this.backend.getItemAsync(this.manifestKey(key));
    if (!serialized) {
      return null;
    }
    try {
      const parsed = JSON.parse(serialized) as unknown;
      return isManifest(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private manifestKey(key: string): string {
    return `${this.namespace}.${safeKey(key)}.manifest`;
  }

  private chunkKey(key: string, generation: string, index: number): string {
    return `${this.namespace}.${safeKey(key)}.${generation}.${index}`;
  }

  private async deleteChunks(key: string, generation: string, count: number): Promise<void> {
    await Promise.all(Array.from({ length: count }, (_, index) => (
      this.backend.deleteItemAsync(this.chunkKey(key, generation, index)).catch(() => undefined)
    )));
  }

  private runExclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function createSecureSessionStorage(): AuthSessionStorage {
  return new ChunkedSecureStoreAdapter({
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  });
}

function splitValue(value: string, chunkSize: number): readonly string[] {
  if (value.length === 0) {
    return [""];
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    chunks.push(value.slice(offset, offset + chunkSize));
  }
  return chunks;
}

function isManifest(value: unknown): value is SecureStoreManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 &&
    typeof candidate.generation === "string" &&
    Number.isInteger(candidate.chunks) &&
    typeof candidate.chunks === "number" &&
    candidate.chunks > 0;
}

function safeKey(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 48);
  return `${normalized}_${hashKey(value)}`;
}

function hashKey(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
