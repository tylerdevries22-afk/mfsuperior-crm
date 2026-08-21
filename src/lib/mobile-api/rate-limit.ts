import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiRateLimitBuckets } from "@/lib/db/schema";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

export type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
};

export interface RateLimiter {
  consume(input: RateLimitInput): Promise<RateLimitDecision>;
}

export type RateLimitStore = {
  increment(
    keyHash: string,
    windowStartedAt: Date,
    expiresAt: Date,
  ): Promise<number>;
};

const databaseStore: RateLimitStore = {
  async increment(keyHash, windowStartedAt, expiresAt) {
    const [bucket] = await db
      .insert(apiRateLimitBuckets)
      .values({ keyHash, windowStartedAt, expiresAt, requestCount: 1 })
      .onConflictDoUpdate({
        target: [
          apiRateLimitBuckets.keyHash,
          apiRateLimitBuckets.windowStartedAt,
        ],
        set: {
          requestCount: sql`${apiRateLimitBuckets.requestCount} + 1`,
          expiresAt,
        },
      })
      .returning({ requestCount: apiRateLimitBuckets.requestCount });
    return bucket.requestCount;
  },
};

export class PersistentRateLimiter implements RateLimiter {
  constructor(private readonly store: RateLimitStore = databaseStore) {}

  async consume(input: RateLimitInput): Promise<RateLimitDecision> {
    const limit = Math.min(Math.max(Math.floor(input.limit), 1), 10_000);
    const windowMs = Math.min(
      Math.max(Math.floor(input.windowMs), 1_000),
      24 * 60 * 60 * 1_000,
    );
    const now = input.now ?? new Date();
    const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
    const windowStartedAt = new Date(windowStartMs);
    const resetAt = new Date(windowStartMs + windowMs);
    const keyHash = createHash("sha256").update(input.key).digest("hex");
    const count = await this.store.increment(keyHash, windowStartedAt, resetAt);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }
}
