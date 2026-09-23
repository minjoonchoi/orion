import { test, expect } from "@playwright/test";
test("language selection persists across relationships, refresh, and login", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "ko", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "사용자", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language / 언어").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await page.locator('a[href^="/users/"]').first().click();
  await expect(page.getByRole("tab", { name: /Organizations/ })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/login");
  await expect(
    page.getByRole("link", { name: "Sign in with Okta" }),
  ).toBeVisible();
  await page.getByLabel("Language / 언어").selectOption("ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});
test("English metadata, headings, and navigation cover every resource", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  for (const route of [
    "users",
    "organizations",
    "roles",
    "policies",
    "services",
    "service-endpoints",
    "workspaces",
    "pages",
    "api-keys",
    "approval-templates",
    "approvals",
    "service-accounts",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.locator("main h1").innerText()).not.toMatch(/[가-힣]/);
    expect(await page.title()).not.toMatch(/[가-힣]/);
    expect(
      await page.locator('nav[aria-label="Main navigation"]').innerText(),
    ).not.toMatch(/[가-힣]/);
  }
});
