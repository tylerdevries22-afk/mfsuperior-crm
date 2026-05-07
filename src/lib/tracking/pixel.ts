import { env } from "@/lib/env";

/**
 * Open-tracking pixel.
 *
 * The pixel URL embeds the email_event id (UUID) so on first GET the
 * `/api/track/open/[id]` route can write an `opened` event linked to the
 * specific message. We use a hidden 1×1 PNG and `display:block` to discourage
 * email clients from inserting a "show images" footer next to it.
 *
 * Honest caveat: Apple Mail Privacy Protection prefetches all images via
 * Apple's proxy, so opens from MPP-protected recipients fire immediately
 * regardless of whether the recipient actually viewed the email. The
 * dashboard treats opens as "indicative, not authoritative" — replies and
 * clicks are the real engagement signal.
 */
export function pixelUrl(eventId: string): string {
  return `${env().APP_URL}/api/track/open/${encodeURIComponent(eventId)}.png`;
}

export function pixelHtml(eventId: string): string {
  const url = pixelUrl(eventId);
  return `<img src="${url}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:1px;height:1px;" />`;
}
