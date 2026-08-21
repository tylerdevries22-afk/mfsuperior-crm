import AsyncStorage, {
  type AsyncStorageStatic,
} from "@react-native-async-storage/async-storage";

import { OperationsDomainError } from "../domain/errors";

export const DEMO_STATE_STORAGE_KEY = "@mf-superior/demo-operations-state";

export interface PersistenceAdapter {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

export class AsyncStoragePersistenceAdapter implements PersistenceAdapter {
  constructor(
    private readonly storage: AsyncStorageStatic = AsyncStorage,
    private readonly key: string = DEMO_STATE_STORAGE_KEY,
  ) {}

  async read(): Promise<string | null> {
    return this.runWithRetry(
      () => this.storage.getItem(this.key),
      "PERSISTENCE_READ_FAILED",
      "Saved demo data could not be loaded.",
    );
  }

  async write(value: string): Promise<void> {
    await this.runWithRetry(
      () => this.storage.setItem(this.key, value),
      "PERSISTENCE_WRITE_FAILED",
      "Demo changes could not be saved.",
    );
  }

  async clear(): Promise<void> {
    await this.runWithRetry(
      () => this.storage.removeItem(this.key),
      "PERSISTENCE_WRITE_FAILED",
      "Saved demo data could not be cleared.",
    );
  }

  private async runWithRetry<Result>(
    operation: () => Promise<Result>,
    code: "PERSISTENCE_READ_FAILED" | "PERSISTENCE_WRITE_FAILED",
    safeMessage: string,
  ): Promise<Result> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await withTimeout(operation(), 3_000);
      } catch {
        if (attempt === 1) {
          throw new OperationsDomainError(code, safeMessage);
        }
      }
    }

    throw new OperationsDomainError(code, safeMessage);
  }
}

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  constructor(private value: string | null = null) {}

  async read(): Promise<string | null> {
    return this.value;
  }

  async write(value: string): Promise<void> {
    this.value = value;
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}

async function withTimeout<Result>(promise: Promise<Result>, timeoutMs: number): Promise<Result> {
  return new Promise<Result>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("Storage operation timed out.")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
