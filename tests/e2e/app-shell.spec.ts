import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.APP_EMAIL ?? "llakshitmathur239@gmail.com");
  await page.getByLabel("Password").fill(process.env.APP_PASSWORD ?? "e2e-test-password-only");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("dashboard is usable without horizontal overflow", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: "Good morning, Lakshit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan now" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});

test("primary navigation reaches profile setup", async ({ page, isMobile }) => {
  const navigation = page.getByRole("navigation", { name: isMobile ? "Mobile navigation" : "Main navigation" });
  await navigation.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Profile & preferences" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose your resume" })).toBeVisible();
});
