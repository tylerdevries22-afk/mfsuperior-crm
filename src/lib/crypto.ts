import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM authenticated encryption for OAuth tokens at rest.
 *
 * Token layout (base64-encoded for storage):
 *   [12 bytes IV][16 bytes auth tag][N bytes ciphertext]
 *
 * The 32-byte key is derived from ENCRYPTION_KEY via SHA-256 so the env var
 * can be any UTF-8 string of sufficient entropy (we still validate ≥32 chars).
 * If the env key changes, all stored tokens become unreadable — that's by
 * design (rotating ENCRYPTION_KEY revokes all stored credentials).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | undefined;

function key(): Buffer {
  if (!cachedKey) {
    cachedKey = createHash("sha256").update(env().ENCRYPTION_KEY).digest();
  }
  return cachedKey;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** For tests / forced rotation — drops the in-process key cache. */
export function _clearKeyCache() {
  cachedKey = undefined;
}
