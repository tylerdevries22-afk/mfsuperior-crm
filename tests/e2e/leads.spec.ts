import { test, expect } from "@playwright/test";

/**
 * These E2E tests cover the public surface (no auth needed):
 *   - the unauth redirect to /login from any /leads/* path
 * Authenticated tests (full import → list → detail flow) require a real
 * Google OAuth session and a working Postgres; they are stubbed below
 * with `test.skip` and will be enabled once a test fixture for auth is in place.
 */

test("unauthenticated /leads redirects to /login", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated /leads/import redirects to /login", async ({ page }) => {
  await page.goto("/leads/import");
  await expect(page).toHaveURL(/\/login$/);
});

test.skip("authed: import 01_Lead_List.xlsx and see 50 leads", async () => {
  // TODO(step-N): once we have a session-cookie fixture or test seeder,
  // upload the kit's 01_Lead_List.xlsx and assert "50 inserted".
});

test.skip("authed: lead detail page shows stage selector and notes form", async () => {
  // TODO(step-N): visit /leads/{seeded-id} and assert the form structure.
});
