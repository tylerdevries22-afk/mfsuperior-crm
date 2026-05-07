import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Unsubscribe token format:  base64url(leadId).base64url(hmacSig)
 *
 * The HMAC binds the lead id to the ENCRYPTION_KEY so a token is only valid
 * for the specific lead it was generated for. There's no expiry on these
 * tokens — unsubscribe links remain valid indefinitely (CAN-SPAM requires
 * the opt-out mechanism to remain functional for at least 30 days, in
 * practice forever for our scale).
 */

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(leadId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`unsub:${leadId}`).digest();
}

export function unsubscribeToken(leadId: string): string {
  const sig = sign(leadId, env().ENCRYPTION_KEY);
  return `${b64url(leadId)}.${b64url(sig)}`;
}

export function unsubscribeUrl(leadId: string): string {
  return `${env().APP_URL}/api/unsubscribe/${unsubscribeToken(leadId)}`;
}

export type VerifiedUnsubscribe =
  | { ok: true; leadId: string }
  | { ok: false; reason: string };

export function verifyUnsubscribeToken(token: string): VerifiedUnsubscribe {
  const dot = token.indexOf(".");
  if (dot < 0) return { ok: false, reason: "malformed token" };
  const idEncoded = token.slice(0, dot);
  const sigEncoded = token.slice(dot + 1);
  let leadId: string;
  let sigGiven: Buffer;
  try {
    leadId = fromB64url(idEncoded).toString("utf8");
    sigGiven = fromB64url(sigEncoded);
  } catch {
    return { ok: false, reason: "decode failed" };
  }
  if (!leadId) return { ok: false, reason: "empty lead id" };
  const sigExpected = sign(leadId, env().ENCRYPTION_KEY);
  if (sigGiven.length !== sigExpected.length) {
    return { ok: false, reason: "signature length mismatch" };
  }
  if (!timingSafeEqual(sigGiven, sigExpected)) {
    return { ok: false, reason: "bad signature" };
  }
  return { ok: true, leadId };
}
