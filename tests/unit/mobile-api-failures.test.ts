import { describe, expect, it } from "vitest";

import { apiFailureResponse, MobileApiError } from "@/lib/mobile-api/http";

/**
 * A constraint violation is something the caller can act on — "that unit number
 * is taken", "that driver is not in your carrier" — and must answer 409, not
 * 500. Drizzle wraps driver errors, so the SQLSTATE sits on `cause` rather than
 * on the error itself; reading only the top level reported every violation as
 * unknown and turned an actionable conflict into "temporarily unavailable".
 * Verified against a real Postgres before this test was written.
 */
async function bodyOf(response: Response) {
  return (await response.json()) as { error?: { code?: string } };
}

describe("database failures map to the right status", () => {
  it("answers 409 for a unique violation raised directly", async () => {
    const response = apiFailureResponse(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
      "req-1",
      "vehicles.write",
    );
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error?.code).toBe("CONFLICT");
  });

  it("answers 409 when the driver error is wrapped, as Drizzle wraps it", async () => {
    const wrapped = new Error("Failed query", {
      cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
    });
    const response = apiFailureResponse(wrapped, "req-2", "vehicles.write");
    expect(response.status).toBe(409);
  });

  it("finds the code through more than one layer of wrapping", async () => {
    const inner = Object.assign(new Error("fk violation"), { code: "23503" });
    const wrapped = new Error("outer", { cause: new Error("middle", { cause: inner }) });
    expect(apiFailureResponse(wrapped, "req-3", "vehicles.assign").status).toBe(409);
  });

  it("still answers 500 for a failure with no SQLSTATE anywhere", async () => {
    const response = apiFailureResponse(new Error("something else"), "req-4", "vehicles.write");
    expect(response.status).toBe(500);
    expect((await bodyOf(response)).error?.code).toBe("INTERNAL_ERROR");
  });

  /** A non-SQLSTATE `code` must not be mistaken for one. */
  it("ignores a code that is not a SQLSTATE", async () => {
    const noisy = Object.assign(new Error("dns"), { code: "ENOTFOUND" });
    expect(apiFailureResponse(noisy, "req-5", "vehicles.write").status).toBe(500);
  });

  it("does not follow a cause cycle forever", async () => {
    const a: { cause?: unknown } = new Error("a");
    const b: { cause?: unknown } = new Error("b");
    a.cause = b;
    b.cause = a;
    expect(apiFailureResponse(a, "req-6", "vehicles.write").status).toBe(500);
  });

  it("passes a deliberate MobileApiError through untouched", async () => {
    const response = apiFailureResponse(
      new MobileApiError(404, "NOT_FOUND", "That vehicle could not be found."),
      "req-7",
      "vehicles.assign",
    );
    expect(response.status).toBe(404);
    expect((await bodyOf(response)).error?.code).toBe("NOT_FOUND");
  });
});
