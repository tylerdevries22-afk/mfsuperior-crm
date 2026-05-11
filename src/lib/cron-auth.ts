/**
 * Shared bearer-token check for the cron route handlers. Returns null
 * when the request is authorized; otherwise returns a 401 Response with
 * a *safe* diagnostic JSON body that helps the operator figure out why
 * the two secrets don't match — without leaking the secret itself.
 *
 * The diagnostic exposes only:
 *   - received_length: bytes in the Authorization header
 *   - received_has_bearer_prefix
 *   - received_token_length, expected_token_length
 *   - length_match
 *   - received_token_trimmed_changes_length: true if .trim() changes the
 *     received token (= it has leading/trailing whitespace, the classic
 *     "trailing newline pasted into the secret" bug)
 *   - expected_token_trimmed_changes_length: same for the env-side secret
 *   - common_prefix_length: chars that match from the start
 *
 * Knowing common_prefix_length tells you whether the values share a
 * leading section (= same secret with one side truncated/extended) vs
 * being entirely different strings.
 */
export function checkCronAuth(request: Request, expected: string): Response | null {
  const received = request.headers.get("authorization") ?? "";
  if (received === `Bearer ${expected}`) return null;

  const prefix = "Bearer ";
  const hasBearer = received.startsWith(prefix);
  const receivedToken = hasBearer ? received.slice(prefix.length) : received;
  const expectedToken = expected;

  const expectedTrimmed = expectedToken.trim();
  const receivedTrimmed = receivedToken.trim();

  let common = 0;
  const max = Math.min(receivedToken.length, expectedToken.length);
  while (common < max && receivedToken[common] === expectedToken[common]) common++;

  const body = {
    error: "Unauthorized",
    diagnostic: {
      received_length: received.length,
      received_has_bearer_prefix: hasBearer,
      received_token_length: receivedToken.length,
      expected_token_length: expectedToken.length,
      length_match: receivedToken.length === expectedToken.length,
      received_token_trimmed_changes_length:
        receivedTrimmed.length !== receivedToken.length,
      expected_token_trimmed_changes_length:
        expectedTrimmed.length !== expectedToken.length,
      common_prefix_length: common,
      hint:
        receivedToken.length === 0
          ? "Authorization header missing or has no Bearer payload — check the GitHub workflow yml's `Authorization: Bearer ${CRON_SECRET}` line."
          : !hasBearer
            ? "Authorization header isn't a Bearer token. Workflow should send `Authorization: Bearer <secret>`."
            : receivedTrimmed.length !== receivedToken.length
              ? "GitHub Actions CRON_SECRET has leading/trailing whitespace (probably a trailing newline pasted in). Re-paste WITHOUT a trailing newline."
              : expectedTrimmed.length !== expectedToken.length
                ? "Vercel CRON_SECRET has leading/trailing whitespace. Re-paste WITHOUT a trailing newline."
                : receivedToken.length !== expectedToken.length
                  ? `Length mismatch: GitHub side is ${receivedToken.length} chars, Vercel side is ${expectedToken.length} chars. They must be identical.`
                  : common === 0
                    ? "Values are completely different strings. Generate one fresh value with `openssl rand -hex 16` and paste it into both sides."
                    : `Values share the first ${common} chars but diverge after that. One side was truncated or edited; re-paste the same value into both.`,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
