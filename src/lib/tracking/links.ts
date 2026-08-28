import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Click-tracking link rewrite.
 *
 * Every <a href="..."> in an outbound email body is rewritten to point at
 * `/api/track/click/[eventId]?u=base64url(originalUrl)&s=signature`. The route
 * verifies the event-bound HMAC, logs the click, and redirects to the target.
 *
 * Skipped:
 *   - mailto: / tel: links
 *   - URLs that already point at our own APP_URL (unsubscribe link, etc.)
 *   - href="#anchor" fragment-only links
 *   - data: URIs
 */

const ANCHOR_TAG_RE = /<a\b([^>]*?)\bhref\s*=\s*(['"])(.*?)\2([^>]*)>/gi;

function shouldSkip(href: string, appUrl: string): boolean {
  if (!href) return true;
  const trimmed = href.trim();
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("tel:")) return true;
  if (trimmed.startsWith("data:")) return true;
  if (trimmed.startsWith("javascript:")) return true;
  if (trimmed.startsWith(appUrl)) return true; // unsub link, app deep links
  return false;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromB64url(s: string): string {
  if (!s || s.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(s)) {
    throw new Error("Invalid base64url value.");
  }
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  ).toString("utf8");
}

/** Verifies that a click target was emitted for this exact email event. */
export function clickTargetSignatureIsValid(
  eventId: string,
  target: string,
  signature: string,
): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = clickTargetSignature(eventId, target);
  const actualBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes);
}

export type LinkRewriteResult = {
  html: string;
  rewrittenCount: number;
  skippedCount: number;
};

export function rewriteLinks(html: string, eventId: string): LinkRewriteResult {
  const appUrl = env().APP_URL.replace(/\/+$/, "");
  let rewrittenCount = 0;
  let skippedCount = 0;

  const out = html.replace(
    ANCHOR_TAG_RE,
    (_match, beforeHref: string, quote: string, href: string, afterHref: string) => {
      if (shouldSkip(href, appUrl)) {
        skippedCount++;
        return `<a${beforeHref}href=${quote}${href}${quote}${afterHref}>`;
      }
      const tracked = trackedClickUrl(appUrl, eventId, href).replace(/&/g, "&amp;");
      rewrittenCount++;
      return `<a${beforeHref}href=${quote}${tracked}${quote}${afterHref}>`;
    },
  );

  return { html: out, rewrittenCount, skippedCount };
}

export function clickRedirectUrl(eventId: string, target: string): string {
  return trackedClickUrl(env().APP_URL.replace(/\/+$/, ""), eventId, target);
}

function trackedClickUrl(appUrl: string, eventId: string, target: string): string {
  const encodedTarget = b64url(target);
  const signature = clickTargetSignature(eventId, target);
  return `${appUrl}/api/track/click/${encodeURIComponent(eventId)}?u=${encodedTarget}&s=${signature}`;
}

function clickTargetSignature(eventId: string, target: string): string {
  return createHmac("sha256", env().ENCRYPTION_KEY)
    .update(eventId)
    .update("\0")
    .update(target)
    .digest("base64url");
}
