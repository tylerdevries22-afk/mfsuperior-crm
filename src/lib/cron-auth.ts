import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared bearer-token check for the cron route handlers. Returns null when the
 * request is authorized, otherwise a 401.
 *
 * Security note: an earlier version of this helper returned a diagnostic body
 * containing `common_prefix_length` and `expected_token_length`. Together those
 * form a character-by-character oracle — roughly 512 unauthenticated requests
 * recover a 32-character hex secret, which gates the routes that send email to
 * leads. Nothing derived from the expected secret may ever be returned to a
 * caller that has not already proven it knows the secret.
 *
 * What remains is deliberately one-sided: the diagnostics describe only what
 * the caller itself sent (length, Bearer prefix, stray whitespace), which the
 * caller already knows, and they are withheld entirely in production.
 */
export function checkCronAuth(request: Request, expected: string): Response | null {
  const received = request.headers.get("authorization") ?? "";
  if (constantTimeEquals(received, `Bearer ${expected}`)) return null;

  if (process.env.NODE_ENV === "production") {
    return unauthorized({ error: "Unauthorized" });
  }

  const prefix = "Bearer ";
  const hasBearer = received.startsWith(prefix);
  const receivedToken = hasBearer ? received.slice(prefix.length) : received;
  const hasSurroundingWhitespace = receivedToken.trim().length !== receivedToken.length;

  return unauthorized({
    error: "Unauthorized",
    diagnostic: {
      received_length: received.length,
      received_has_bearer_prefix: hasBearer,
      received_token_length: receivedToken.length,
      received_token_has_surrounding_whitespace: hasSurroundingWhitespace,
      hint: hintFor(receivedToken, hasBearer, hasSurroundingWhitespace),
    },
  });
}

function hintFor(
  receivedToken: string,
  hasBearer: boolean,
  hasSurroundingWhitespace: boolean,
): string {
  if (receivedToken.length === 0) {
    return "Authorization header missing or has no Bearer payload — check the workflow's `Authorization: Bearer ${CRON_SECRET}` line.";
  }
  if (!hasBearer) {
    return "Authorization header isn't a Bearer token. Send `Authorization: Bearer <secret>`.";
  }
  if (hasSurroundingWhitespace) {
    return "The sent CRON_SECRET has leading/trailing whitespace (usually a pasted trailing newline). Re-paste it without one.";
  }
  return "The sent CRON_SECRET does not match the server's. Regenerate one value with `openssl rand -hex 16` and paste it into both sides.";
}

/**
 * Constant-time compare of two arbitrary-length strings. `timingSafeEqual`
 * throws when the buffers differ in length, and returning early on that check
 * would itself leak the secret's length, so both sides are reduced to
 * fixed-width SHA-256 digests first.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

function unauthorized(body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
