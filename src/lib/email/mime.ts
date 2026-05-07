import { randomBytes } from "node:crypto";

/**
 * Build an RFC 5322 raw message with a multipart/alternative body
 * (text/plain first, text/html second, per RFC 2046 §5.1.4 — clients
 * should prefer the last understood part). Returns the raw message as a
 * UTF-8 string ready to be base64url-encoded for the Gmail API.
 */

export type MimeBuildInput = {
  /** RFC 5322 mailbox: "Display Name <addr@host>" or just "addr@host". */
  from: string;
  /** Single recipient. */
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Optional Message-ID we're replying to (sets In-Reply-To and References).
   * If set, Gmail threads the new message with that thread.
   */
  inReplyTo?: string;
  /** Free-form headers (e.g. List-Unsubscribe, List-Unsubscribe-Post). */
  extraHeaders?: Record<string, string>;
};

const SAFE_HEADER = /^[\x20-\x7E]+$/; // printable ASCII; no CR/LF

function encodeHeaderValue(s: string): string {
  // RFC 2047 encoded-word for any non-ASCII header content (subjects, names).
  if (SAFE_HEADER.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function ensureCrlf(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

/** RFC 822 date in UTC (e.g. "Wed, 07 May 2026 14:30:00 +0000"). */
function rfc822Date(d = new Date()): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`
  );
}

export function buildRawMime(input: MimeBuildInput): string {
  const boundary = `mfboundary_${randomBytes(8).toString("hex")}`;
  const headers: string[] = [];

  headers.push(`From: ${input.from}`);
  headers.push(`To: ${input.to}`);
  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`);
  headers.push(`Date: ${rfc822Date()}`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
    headers.push(`References: ${input.inReplyTo}`);
  }
  if (input.extraHeaders) {
    for (const [k, v] of Object.entries(input.extraHeaders)) {
      if (!v) continue;
      // Headers must not contain CR/LF; collapse to spaces if any sneak in.
      headers.push(`${k}: ${v.replace(/\r?\n/g, " ")}`);
    }
  }

  const textPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
  ].join("\r\n");

  const closing = `--${boundary}--`;

  const message = [
    headers.join("\r\n"),
    "",
    textPart,
    "",
    htmlPart,
    "",
    closing,
    "",
  ].join("\r\n");

  return ensureCrlf(message);
}

/** Encode a raw RFC 5322 message for the Gmail API (`raw` field). */
export function toGmailRaw(rawMessage: string): string {
  return Buffer.from(rawMessage, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
