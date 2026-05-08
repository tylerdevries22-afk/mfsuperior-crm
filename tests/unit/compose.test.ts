import { describe, it, expect, vi, beforeEach } from "vitest";
import { composeEmail } from "../../src/lib/email/compose";

// Mock env so pixelUrl doesn't throw on missing APP_URL
vi.mock("../../src/lib/env", () => ({
  env: () => ({
    APP_URL: "http://localhost:3000",
    RESEND_API_KEY: "re_test",
    AUTH_SECRET: "x".repeat(32),
    AUTH_GOOGLE_ID: "id",
    AUTH_GOOGLE_SECRET: "secret",
    CRON_SECRET: "x".repeat(16),
    ENCRYPTION_KEY: "x".repeat(32),
    BUSINESS_NAME: "Test Co",
    BUSINESS_ADDRESS: "123 Main St",
    DAILY_SEND_CAP: 20,
    WARMUP_DAYS: 7,
    WARMUP_DAILY_CAP: 5,
    NODE_ENV: "test",
  }),
}));

const BASE_SETTINGS = {
  senderName: "Tyler Devries",
  senderEmail: "info@mfsuperiorproducts.com",
  senderTitle: "Owner",
  senderPhone: "(256) 468-0751",
  businessName: "MF Superior Solutions",
  businessAddress: "15321 E Louisiana Ave, Aurora, CO 80017",
  businessMc: "123456",
  businessUsdot: "7891011",
};

const BASE_LEAD = {
  id: "lead-uuid-1",
  firstName: "Jane",
  lastName: "Smith",
  companyName: "Acme Freight",
  city: "Denver",
  state: "CO",
  vertical: "retail",
};

describe("composeEmail", () => {
  it("substitutes {{first_name}} in subject and body", () => {
    const result = composeEmail({
      eventId: "event-1",
      lead: BASE_LEAD,
      subject: "Hi {{first_name}}, quick question",
      bodyHtml: "<p>Hello {{first_name}},</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.subject).toBe("Hi Jane, quick question");
    expect(result.html).toContain("Hello Jane");
  });

  it("substitutes {{company_name}}", () => {
    const result = composeEmail({
      eventId: "event-2",
      lead: BASE_LEAD,
      subject: "Freight for {{company_name}}",
      bodyHtml: "<p>We'd love to serve {{company_name}}.</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.subject).toBe("Freight for Acme Freight");
    expect(result.html).toContain("Acme Freight");
  });

  it("appends CAN-SPAM footer to HTML and text", () => {
    const result = composeEmail({
      eventId: "event-3",
      lead: BASE_LEAD,
      subject: "Test",
      bodyHtml: "<p>body</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.html).toContain("15321 E Louisiana Ave");
    expect(result.text).toContain("15321 E Louisiana Ave");
  });

  it("includes List-Unsubscribe headers", () => {
    const result = composeEmail({
      eventId: "event-4",
      lead: BASE_LEAD,
      subject: "Test",
      bodyHtml: "<p>body</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.headers["List-Unsubscribe"]).toMatch(/unsubscribe/);
    expect(result.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("embeds open-tracking pixel in HTML", () => {
    const result = composeEmail({
      eventId: "event-pixel-test",
      lead: BASE_LEAD,
      subject: "Track me",
      bodyHtml: "<p>body</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.html).toContain("/api/track/open/event-pixel-test");
  });

  it("leaves {{unknown_var}} unreplaced and records it in meta.unknown", () => {
    const result = composeEmail({
      eventId: "event-5",
      lead: BASE_LEAD,
      subject: "{{unknown_var}}",
      bodyHtml: "<p>body</p>",
      settings: BASE_SETTINGS,
    });
    expect(result.meta.unknown).toContain("unknown_var");
  });

  it("rewrites http links for click tracking", () => {
    const result = composeEmail({
      eventId: "event-click",
      lead: BASE_LEAD,
      subject: "Test",
      bodyHtml: `<p><a href="http://example.com">click</a></p>`,
      settings: BASE_SETTINGS,
    });
    expect(result.meta.rewrittenLinkCount).toBeGreaterThan(0);
    expect(result.html).toContain("/api/track/click/");
  });

  it("derives plain text from HTML when bodyText is not provided", () => {
    const result = composeEmail({
      eventId: "event-6",
      lead: BASE_LEAD,
      subject: "Test",
      bodyHtml: "<p>Hello <strong>World</strong></p>",
      settings: BASE_SETTINGS,
    });
    expect(result.text).toContain("Hello World");
    expect(result.text).not.toContain("<strong>");
  });
});
