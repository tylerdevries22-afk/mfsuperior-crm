import { env } from "@/lib/env";

/**
 * Click-tracking link rewrite.
 *
 * Every <a href="..."> in an outbound email body is rewritten to point at
 * `/api/track/click/[eventId]?u=base64url(originalUrl)`. The route logs the
 * click and 302-redirects to the original URL.
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
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  ).toString("utf8");
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
      const tracked = `${appUrl}/api/track/click/${encodeURIComponent(eventId)}?u=${b64url(href)}`;
      rewrittenCount++;
      return `<a${beforeHref}href=${quote}${tracked}${quote}${afterHref}>`;
    },
  );

  return { html: out, rewrittenCount, skippedCount };
}

export function clickRedirectUrl(eventId: string, target: string): string {
  return `${env().APP_URL}/api/track/click/${encodeURIComponent(eventId)}?u=${b64url(target)}`;
}
