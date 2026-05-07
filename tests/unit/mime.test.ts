import { describe, it, expect } from "vitest";
import { buildRawMime, toGmailRaw } from "@/lib/email/mime";

describe("buildRawMime", () => {
  const base = {
    from: '"Tyler DeVries" <tylerdevries22@gmail.com>',
    to: "sam@elite-brands.example",
    subject: "Hi Sam at Elite Brands of Colorado",
    html: "<p>Hi Sam,</p><p>...</p>",
    text: "Hi Sam,\n\n...",
  };

  it("emits required RFC 5322 headers and a multipart/alternative body", () => {
    const raw = buildRawMime(base);
    expect(raw).toContain("From: \"Tyler DeVries\" <tylerdevries22@gmail.com>");
    expect(raw).toContain("To: sam@elite-brands.example");
    expect(raw).toContain("Subject: Hi Sam at Elite Brands of Colorado");
    expect(raw).toContain("MIME-Version: 1.0");
    expect(raw).toMatch(/Content-Type: multipart\/alternative; boundary="mfboundary_[0-9a-f]+"/);
  });

  it("uses CRLF line endings throughout (per RFC 5322)", () => {
    const raw = buildRawMime(base);
    // Every newline should be preceded by a CR.
    const lfPositions: number[] = [];
    for (let i = 0; i < raw.length; i++) if (raw[i] === "\n") lfPositions.push(i);
    expect(lfPositions.length).toBeGreaterThan(0);
    for (const i of lfPositions) {
      expect(raw[i - 1]).toBe("\r");
    }
  });

  it("includes both the text and HTML parts in order", () => {
    const raw = buildRawMime(base);
    const textIdx = raw.indexOf("Content-Type: text/plain");
    const htmlIdx = raw.indexOf("Content-Type: text/html");
    expect(textIdx).toBeGreaterThan(0);
    expect(htmlIdx).toBeGreaterThan(textIdx); // text first, html second
    expect(raw).toContain("Hi Sam,");
    expect(raw).toContain("<p>Hi Sam,</p>");
  });

  it("encodes a non-ASCII subject as RFC 2047", () => {
    const raw = buildRawMime({ ...base, subject: "Héllo — über/grüß" });
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });

  it("adds In-Reply-To and References when threading", () => {
    const raw = buildRawMime({
      ...base,
      inReplyTo: "<original@mail.gmail.com>",
    });
    expect(raw).toContain("In-Reply-To: <original@mail.gmail.com>");
    expect(raw).toContain("References: <original@mail.gmail.com>");
  });

  it("emits extra headers (List-Unsubscribe etc.) and strips embedded newlines", () => {
    const raw = buildRawMime({
      ...base,
      extraHeaders: {
        "List-Unsubscribe": "<mailto:unsub@host>, <https://app.example/u/abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Bad": "value\nwith\nnewlines",
      },
    });
    expect(raw).toContain(
      "List-Unsubscribe: <mailto:unsub@host>, <https://app.example/u/abc>",
    );
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(raw).toContain("X-Bad: value with newlines");
    expect(raw).not.toMatch(/X-Bad: value\nwith/);
  });

  it("includes a Date header in RFC 822 format", () => {
    const raw = buildRawMime(base);
    expect(raw).toMatch(/^Date: (Sun|Mon|Tue|Wed|Thu|Fri|Sat), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/m);
  });
});

describe("toGmailRaw", () => {
  it("produces base64url with no padding", () => {
    const out = toGmailRaw("hello world");
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(out).not.toContain("=");
    // Round-trip: base64url decode equals original.
    const padded = out + "=".repeat((4 - (out.length % 4)) % 4);
    expect(
      Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ).toBe("hello world");
  });
});
