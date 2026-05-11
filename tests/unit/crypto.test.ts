import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    AUTH_SECRET: "x".repeat(32),
    AUTH_GOOGLE_ID: "id",
    AUTH_GOOGLE_SECRET: "secret",
    APP_URL: "http://localhost:3000",
    CRON_SECRET: "x".repeat(16),
    ENCRYPTION_KEY: "test-encryption-key-test-encryption-key",
    GMAIL_USER: "tylerdevries22@gmail.com",
    BUSINESS_NAME: "MF Superior Products",
    BUSINESS_ADDRESS: "15321 E Louisiana Ave, Aurora, CO 80017",
    NODE_ENV: "test",
  });
});

describe("crypto round-trip", () => {
  it("encrypts and decrypts a token", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto");
    const refresh = "1//refresh-token-with-some-entropy-12345";
    const encoded = encryptToken(refresh);
    expect(encoded).not.toBe(refresh);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptToken(encoded)).toBe(refresh);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const { encryptToken } = await import("@/lib/crypto");
    const a = encryptToken("same-plaintext");
    const b = encryptToken("same-plaintext");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext (auth tag fails)", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto");
    const enc = encryptToken("abc");
    // Flip a single character in the middle of the base64 payload.
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });

  it("rejects truncated ciphertext", async () => {
    const { decryptToken } = await import("@/lib/crypto");
    expect(() => decryptToken("AAA=")).toThrow();
  });
});
