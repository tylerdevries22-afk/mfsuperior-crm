/**
 * Pure helpers used by the inbox poller. Kept separate so they can be
 * unit-tested without instantiating the Gmail client.
 */

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

/** Extracts the address from "Display Name <addr@host>" or returns the input lower-cased. */
export function extractAddress(rawHeader: string): string {
  const m = rawHeader.match(EMAIL_RE);
  return (m?.[1] ?? rawHeader).trim().toLowerCase();
}

/**
 * Heuristics for "this message is a delivery failure notification."
 *
 * Mailer-Daemon names vary by provider — we match on a small set of common
 * locals and on a few well-known bounce subdomains. We also look at the
 * subject because some servers send DSNs from non-obvious addresses.
 */
export function isBounceSender(fromAddress: string, subject: string): boolean {
  const f = fromAddress.toLowerCase();
  const s = subject.toLowerCase();
  const at = f.indexOf("@");
  const local = at >= 0 ? f.slice(0, at) : f;
  const domain = at >= 0 ? f.slice(at + 1) : "";

  // Localpart-based: Mailer-Daemon, Postmaster, ESP "bounces+token" patterns.
  if (local === "mailer-daemon" || local.startsWith("mailer-daemon")) return true;
  if (local === "postmaster" || local.startsWith("postmaster")) return true;
  if (local.startsWith("bounces+") || local.startsWith("bounce+")) return true;

  // Domain-based: well-known bounce subdomains.
  if (
    domain.startsWith("bounces.") ||
    domain.startsWith("bounce.") ||
    domain.includes(".bounces.") ||
    domain.includes(".bounce.")
  ) {
    return true;
  }

  // Subject patterns ("Delivery Status Notification (Failure)", "Undeliverable", etc.)
  if (s.startsWith("delivery status notification")) return true;
  if (s.startsWith("undeliverable")) return true;
  if (s.startsWith("undelivered mail returned")) return true;
  if (s.startsWith("mail delivery failed")) return true;
  if (s.startsWith("returned mail")) return true;

  return false;
}

/**
 * Decides whether a thread message is a third-party reply (i.e. not us).
 * Returns the reply category, or `null` if the message is from the operator.
 */
export function classifyMessage(
  from: string,
  subject: string,
  operatorEmail: string,
): "reply" | "bounce" | null {
  const sender = extractAddress(from);
  const operator = operatorEmail.toLowerCase();
  if (sender === operator) return null;
  if (isBounceSender(sender, subject)) return "bounce";
  return "reply";
}
