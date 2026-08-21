import { z } from "zod";
import { MobileApiError } from "./http";

const cursorPayloadSchema = z
  .object({ version: z.literal(1), highWatermark: z.iso.datetime({ offset: true }) })
  .strict();

export function encodeSyncCursor(highWatermark: Date): string {
  return `v1.${Buffer.from(
    JSON.stringify({ version: 1, highWatermark: highWatermark.toISOString() }),
  ).toString("base64url")}`;
}

export function decodeSyncCursor(cursor: string): Date {
  if (!cursor.startsWith("v1.")) {
    throw new MobileApiError(400, "INVALID_QUERY", "The sync cursor is invalid.");
  }
  try {
    const value = JSON.parse(
      Buffer.from(cursor.slice(3), "base64url").toString("utf8"),
    ) as unknown;
    const parsed = cursorPayloadSchema.parse(value);
    const date = new Date(parsed.highWatermark);
    if (date.getTime() > Date.now() + 5 * 60_000) {
      throw new Error("Future cursor");
    }
    return date;
  } catch {
    throw new MobileApiError(400, "INVALID_QUERY", "The sync cursor is invalid.");
  }
}
