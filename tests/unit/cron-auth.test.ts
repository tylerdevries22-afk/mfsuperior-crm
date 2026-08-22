import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCronAuth } from "@/lib/cron-auth";

const SECRET = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function request(authorization?: string): Request {
  return new Request("https://crm.example/api/cron/run-all", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron bearer authentication", () => {
  it("authorizes only the exact bearer token", async () => {
    expect(checkCronAuth(request(`Bearer ${SECRET}`), SECRET)).toBeNull();
    // HTTP normalizes surrounding header whitespace, so a pasted trailing
    // newline arrives already trimmed and legitimately authorizes.
    expect(checkCronAuth(request(`Bearer ${SECRET}\n`), SECRET)).toBeNull();
    expect(checkCronAuth(request(`Bearer ${SECRET}x`), SECRET)?.status).toBe(401);
    expect(checkCronAuth(request(`Bearer ${SECRET.slice(0, -1)}`), SECRET)?.status).toBe(401);
    expect(checkCronAuth(request(SECRET), SECRET)?.status).toBe(401);
    expect(checkCronAuth(request(), SECRET)?.status).toBe(401);
  });

  /**
   * Regression guard. A previous version returned `common_prefix_length` and
   * `expected_token_length`, which together let an unauthenticated caller
   * recover the secret one character at a time in roughly 512 requests.
   */
  it("never reveals anything derived from the real secret", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const guesses = ["Bearer a", `Bearer ${SECRET.slice(0, 20)}`, "Bearer zzz", "Bearer "];
    for (const guess of guesses) {
      const response = checkCronAuth(request(guess), SECRET);
      expect(response?.status).toBe(401);
      const text = await response!.text();
      expect(text).not.toContain("common_prefix_length");
      expect(text).not.toContain("expected_token_length");
      expect(text).not.toContain("expected_token_trimmed_changes_length");
      expect(text).not.toContain(SECRET);
      // The secret's length must not be inferable either.
      expect(text).not.toContain(String(SECRET.length));
    }
  });

  it("returns a bare unauthorized body in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = checkCronAuth(request("Bearer wrong"), SECRET);
    expect(response?.status).toBe(401);
    expect(JSON.parse(await response!.text())).toEqual({ error: "Unauthorized" });
  });

  it("still helps a developer diagnose a local mismatch", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // Interior whitespace survives header normalization, unlike a trailing one.
    const response = checkCronAuth(request(`Bearer  ${SECRET}`), SECRET);
    const body = JSON.parse(await response!.text());
    expect(body.diagnostic.received_token_has_surrounding_whitespace).toBe(true);
    expect(body.diagnostic).not.toHaveProperty("common_prefix_length");
  });
});
