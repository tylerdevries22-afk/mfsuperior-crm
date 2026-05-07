import { test, expect } from "@playwright/test";

test("unauthenticated visit to / redirects to /login and renders branded card", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /MF Superior/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test("login page exposes the brand logo with alt text", async ({ page }) => {
  await page.goto("/login");
  const logo = page.getByAltText("MF Superior Products");
  await expect(logo).toBeVisible();
});
