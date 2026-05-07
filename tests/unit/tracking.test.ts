import { describe, it, expect, beforeEach, beforeAll } from "vitest";

const VALID_ENV = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
  AUTH_GOOGLE_ID: "id",
  AUTH_GOOGLE_SECRET: "secret",
  APP_URL: "http://localhost:3000",
  CRON_SECRET: "x".repeat(16),
  ENCRYPTION_KEY: "test-encryption-key-test-encryption-key",
  GMAIL_USER: "tylerdevries22@gmail.com",
  BUSINESS_NAME: "MF Superior Solutions",
  BUSINESS_ADDRESS: "15321 E Louisiana Ave, Aurora, CO 80017",
  NODE_ENV: "test",
};

beforeAll(() => {
  Object.assign(process.env, VALID_ENV);
});

beforeEach(() => {
  // Modules are cached; the env() function memoizes its parsed result.
  // We don't reset modules here — these tests don't need a fresh env.
});

describe("link rewriting", () => {
  it("rewrites external <a href> URLs through /api/track/click", async () => {
    const { rewriteLinks } = await import("@/lib/tracking/links");
    const html = `<p>Hello <a href="https://example.com/foo?x=1">visit</a> us.</p>`;
    const result = rewriteLinks(
      html,
      "11111111-2222-3333-4444-555555555555",
    );
    expect(result.rewrittenCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.html).toContain("/api/track/click/11111111-2222-3333-4444-555555555555");
    expect(result.html).not.toContain("https://example.com/foo");
  });

  it("skips mailto: tel: hash and same-origin app links", async () => {
    const { rewriteLinks } = await import("@/lib/tracking/links");
    const html = [
      `<a href="mailto:foo@bar.com">mail</a>`,
      `<a href="tel:+13035550119">call</a>`,
      `<a href="#anchor">jump</a>`,
      `<a href="http://localhost:3000/api/unsubscribe/abc.def">unsub</a>`,
      `<a href="https://example.com/x">tracked</a>`,
    ].join(" ");
    const r = rewriteLinks(html, "11111111-2222-3333-4444-555555555555");
    expect(r.rewrittenCount).toBe(1);
    expect(r.skippedCount).toBe(4);
    // Same-origin link should be untouched
    expect(r.html).toContain(`href="http://localhost:3000/api/unsubscribe/abc.def"`);
  });

  it("preserves attributes on the <a> tag (target, rel, class)", async () => {
    const { rewriteLinks } = await import("@/lib/tracking/links");
    const html = `<a class="link" target="_blank" rel="noopener" href="https://example.com">x</a>`;
    const r = rewriteLinks(html, "11111111-2222-3333-4444-555555555555");
    expect(r.html).toContain('class="link"');
    expect(r.html).toContain('target="_blank"');
    expect(r.html).toContain('rel="noopener"');
  });
});

describe("unsubscribe token", () => {
  it("round-trips a valid token", async () => {
    const { unsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/tracking/unsubscribe"
    );
    const id = "abcd1234-5678-9012-3456-789012345678";
    const token = unsubscribeToken(id);
    const result = verifyUnsubscribeToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.leadId).toBe(id);
  });

  it("rejects a token bound to a different lead id (signature mismatch)", async () => {
    const { unsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/tracking/unsubscribe"
    );
    const goodToken = unsubscribeToken("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    // Tamper: replace the lead-id portion (before the dot) with a different one.
    // Re-encode the new id using base64url so the parser doesn't reject decoding.
    const otherId = "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee";
    const enc = (s: string) =>
      Buffer.from(s, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const tampered = `${enc(otherId)}.${goodToken.split(".")[1]}`;
    const result = verifyUnsubscribeToken(tampered);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const { verifyUnsubscribeToken } = await import("@/lib/tracking/unsubscribe");
    expect(verifyUnsubscribeToken("not-a-token").ok).toBe(false);
    expect(verifyUnsubscribeToken("only-one-part").ok).toBe(false);
  });
});

describe("CAN-SPAM footer", () => {
  it("contains the business name, address lines, and unsubscribe link", async () => {
    const { buildFooter } = await import("@/lib/compliance/footer");
    const f = buildFooter({
      leadId: "abcd1234-5678-9012-3456-789012345678",
      businessName: "MF Superior Solutions",
      businessAddress: "15321 E Louisiana Ave\nAurora, CO 80017",
      businessMc: "MC-123456",
      businessUsdot: "USDOT 7654321",
    });
    expect(f.html).toContain("MF Superior Solutions");
    expect(f.html).toContain("15321 E Louisiana Ave");
    expect(f.html).toContain("Aurora, CO 80017");
    expect(f.html).toContain("MC# MC-123456");
    expect(f.html).toContain("USDOT# USDOT 7654321");
    expect(f.html).toMatch(/\/api\/unsubscribe\/[A-Za-z0-9_\-.]+/);

    expect(f.text).toContain("MF Superior Solutions");
    expect(f.text).toContain("15321 E Louisiana Ave");
    expect(f.text).toMatch(/Unsubscribe: http:\/\/localhost:3000\/api\/unsubscribe\//);
  });

  it("escapes HTML in business name to prevent XSS in the footer", async () => {
    const { buildFooter } = await import("@/lib/compliance/footer");
    const f = buildFooter({
      leadId: "abcd1234-5678-9012-3456-789012345678",
      businessName: '<script>alert(1)</script>',
      businessAddress: "Anywhere",
    });
    expect(f.html).not.toContain("<script>alert(1)</script>");
    expect(f.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("composeEmail integration", () => {
  it("renders subject + html + text, rewrites links, appends footer + pixel, sets List-Unsubscribe headers", async () => {
    const { composeEmail } = await import("@/lib/email/compose");
    const composed = composeEmail({
      eventId: "11111111-2222-3333-4444-555555555555",
      lead: {
        id: "abcd1234-5678-9012-3456-789012345678",
        firstName: "Sam",
        companyName: "Elite Brands of Colorado",
        vertical: "Beverage Distributor",
      },
      subject: "Hi {{first_name}} at {{company_name}}",
      bodyHtml: `<p>Hi {{first_name}},</p><p>Visit our <a href="https://mf.example/about">site</a>.</p>`,
      bodyText: `Hi {{first_name}},\n\nVisit https://mf.example/about`,
      settings: {
        senderName: "Tyler DeVries",
        senderEmail: "tylerdevries22@gmail.com",
        businessName: "MF Superior Solutions",
        senderTitle: "Owner",
        senderPhone: "(303) 555-0119",
        businessMc: "MC-1",
        businessUsdot: "USDOT 1",
        businessAddress: "15321 E Louisiana Ave\nAurora, CO 80017",
      },
    });

    expect(composed.subject).toBe("Hi Sam at Elite Brands of Colorado");
    expect(composed.html).toContain("Hi Sam,");
    expect(composed.html).toContain("/api/track/click/");
    expect(composed.html).not.toContain("https://mf.example/about");
    expect(composed.html).toContain("/api/track/open/");
    expect(composed.html).toContain("MF Superior Solutions");
    expect(composed.html).toContain("Aurora, CO 80017");

    expect(composed.text).toContain("Hi Sam,");
    expect(composed.text).toContain("Unsubscribe:");

    expect(composed.headers["List-Unsubscribe"]).toMatch(/<mailto:.*tylerdevries.*>, <http.*\/api\/unsubscribe\//);
    expect(composed.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    expect(composed.meta.rewrittenLinkCount).toBe(1);
    expect(composed.meta.unknown).toEqual([]);
  });
});
