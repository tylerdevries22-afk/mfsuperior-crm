import { describe, it, expect, beforeEach, vi } from "vitest";

const VALID_ENV = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
  AUTH_GOOGLE_ID: "id",
  AUTH_GOOGLE_SECRET: "secret",
  APP_URL: "http://localhost:3000",
  CRON_SECRET: "x".repeat(16),
  ENCRYPTION_KEY: "x".repeat(32),
  GMAIL_USER: "tylerdevries22@gmail.com",
  BUSINESS_NAME: "MF Superior Solutions",
  BUSINESS_ADDRESS: "15321 E Louisiana Ave, Aurora, CO 80017",
  NODE_ENV: "test",
};

beforeEach(() => {
  vi.resetModules();
  for (const k of Object.keys(VALID_ENV)) delete (process.env as Record<string, string | undefined>)[k];
});

describe("env()", () => {
  it("parses a valid env block", async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import("@/lib/env");
    const e = env();
    expect(e.BUSINESS_NAME).toBe("MF Superior Solutions");
    expect(e.DAILY_SEND_CAP).toBe(20); // default
    expect(e.WARMUP_DAILY_CAP).toBe(5); // default
  });

  it("throws on a missing required var", async () => {
    Object.assign(process.env, VALID_ENV);
    delete (process.env as Record<string, string | undefined>).BUSINESS_ADDRESS;
    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/BUSINESS_ADDRESS/);
  });

  it("rejects a bad email for GMAIL_USER", async () => {
    Object.assign(process.env, { ...VALID_ENV, GMAIL_USER: "not-an-email" });
    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/GMAIL_USER/);
  });
});
