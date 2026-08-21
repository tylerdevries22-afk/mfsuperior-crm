import AsyncStorage, { type AsyncStorageStatic } from "@react-native-async-storage/async-storage";

export const OFFLINE_QUEUE_STORAGE_KEY = "@mf-superior-products/offline-mutations-v1";

export interface OfflineQueueStorage {
  clear(): Promise<void>;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export class AsyncOfflineQueueStorage implements OfflineQueueStorage {
  constructor(
    private readonly storage: AsyncStorageStatic = AsyncStorage,
    private readonly key: string = OFFLINE_QUEUE_STORAGE_KEY,
  ) {}

  async clear(): Promise<void> {
    await this.storage.removeItem(this.key);
  }

  async read(): Promise<string | null> {
    return this.storage.getItem(this.key);
  }

  async write(value: string): Promise<void> {
    await this.storage.setItem(this.key, value);
  }
}

export class MemoryOfflineQueueStorage implements OfflineQueueStorage {
  constructor(private value: string | null = null) {}

  async clear(): Promise<void> {
    this.value = null;
  }

  async read(): Promise<string | null> {
    return this.value;
  }

  async write(value: string): Promise<void> {
    this.value = value;
  }
}
