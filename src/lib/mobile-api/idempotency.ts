import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mobileMutationReceipts } from "@/lib/db/schema";
import type { MobilePrincipal } from "./authorize";
import { MobileApiError } from "./http";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function canonicalRequestHash(value: JsonValue): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

type IdempotentMutationInput<TPayload> = {
  principal: MobilePrincipal;
  idempotencyKey: string;
  operation: string;
  payload: TPayload;
};

type MutationResult<TResult> = {
  status: number;
  data: TResult;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function executeIdempotentMutation<
  TPayload,
  TResult extends JsonValue,
>(
  input: IdempotentMutationInput<TPayload>,
  execute: (transaction: Transaction) => Promise<MutationResult<TResult>>,
): Promise<MutationResult<TResult> & { replayed: boolean }> {
  const requestHash = canonicalRequestHash(
    JSON.parse(
      JSON.stringify({ operation: input.operation, payload: input.payload }),
    ) as JsonValue,
  );
  return db.transaction(async (transaction) => {
    const lockKey = `${input.principal.organizationId}:${input.principal.userId}:${input.idempotencyKey}`;
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    );
    const [existing] = await transaction
      .select({
        requestHash: mobileMutationReceipts.requestHash,
        responseStatus: mobileMutationReceipts.responseStatus,
        responseBody: mobileMutationReceipts.responseBody,
      })
      .from(mobileMutationReceipts)
      .where(
        and(
          eq(
            mobileMutationReceipts.organizationId,
            input.principal.organizationId,
          ),
          eq(mobileMutationReceipts.actorUserId, input.principal.userId),
          eq(mobileMutationReceipts.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new MobileApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "The idempotency key was already used for a different request.",
        );
      }
      return {
        status: existing.responseStatus,
        data: existing.responseBody as TResult,
        replayed: true,
      };
    }

    const result = await execute(transaction);
    await transaction.insert(mobileMutationReceipts).values({
      organizationId: input.principal.organizationId,
      actorUserId: input.principal.userId,
      idempotencyKey: input.idempotencyKey,
      operation: input.operation,
      requestHash,
      responseStatus: result.status,
      responseBody: result.data,
    });
    return { ...result, replayed: false };
  });
}
