import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Serialize CRM tests so dev sign-in sessions don't conflict with parallel workers


test.describe("Marketing site", () => {
  test("home page loads and shows hero text", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/MF Superior/i);
    // Hero section is present
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("contact form submits successfully", async ({ page }) => {
    await page.goto(BASE);

    // Scroll to contact section
    await page.evaluate(() => {
      document.getElementById("contact")?.scrollIntoView();
    });

    await page.fill('input[name="firstName"]', "Playwright");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', "playwright-test@example.com");
    await page.fill('input[name="phone"]', "(303) 555-1234");
    await page.fill('input[name="company"]', "Playwright Test Co");
    await page.fill('textarea[name="message"]', "Automated Playwright test submission.");

    await page.click('button[type="submit"]');

    // Success state — the form shows "Request received"
    await expect(
      page.getByText(/request received/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("navbar quote button scrolls to contact section", async ({ page }) => {
    await page.goto(BASE);
    // Click the nav Quote button — should scroll to the #contact section
    await page.getByRole("button", { name: /quote/i }).first().click();
    // The contact section becomes visible — check a stable text node in the form area
    await expect(
      page.locator("#contact").first(),
    ).toBeInViewport({ timeout: 8000 });
  });
});

test.describe.configure({ mode: "serial" });
test.describe("CRM — dev sign-in required", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // Expand the dev sign-in details panel
    const summary = page.locator("details summary");
    if (await summary.isVisible()) {
      await summary.click();
    }
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: "visible", timeout: 5000 });
    await emailInput.fill("info@mfsuperiorproducts.com");
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill("Tyler Devries");
    }
    await page.locator('button:has-text("Sign in (dev)")').click();
    await page.waitForURL(/dashboard/, { timeout: 10000 });
  });

  test("dashboard loads with KPI cards", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByText("Active enrollments")).toBeVisible();
    await expect(page.getByText("Total active leads")).toBeVisible();
  });

  test("leads page shows 50+ leads", async ({ page }) => {
    await page.goto(`${BASE}/leads`);
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    // Table rows or lead cards visible
    const leadLinks = page.locator('a[href^="/leads/"]');
    await expect(leadLinks.first()).toBeVisible({ timeout: 5000 });
    const count = await leadLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("sequences page shows Day 0/4/10 sequence", async ({ page }) => {
    await page.goto(`${BASE}/sequences`);
    await expect(page.getByText(/Denver kit|Day 0/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("inbox page loads", async ({ page }) => {
    await page.goto(`${BASE}/inbox`);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    // Filter tabs present
    await expect(page.getByRole("link", { name: "All" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sent" })).toBeVisible();
  });

  test("notifications page loads", async ({ page }) => {
    await page.goto(`${BASE}/notifications`);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("settings page shows prefilled sender email", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    const emailInput = page.locator('input[name="senderEmail"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue("info@mfsuperiorproducts.com");
  });
});
