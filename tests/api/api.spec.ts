import { test, expect } from "@playwright/test";
test("one build selects different regional APIs and login URLs at runtime", async ({
  page,
}) => {
  for (const [port, region] of [
    [3200, "kr"],
    [3201, "us"],
  ] as const) {
    await page.goto(`http://127.0.0.1:${port}/users`);
    await expect(
      page.getByRole("link", { name: `Live ${region} en`, exact: true }),
    ).toHaveCount(2);
    await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
    await page
      .getByRole("link", { name: `Live ${region} en`, exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: `Live ${region} en`, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Related API user" }).click();
    await expect(page).toHaveURL(/remote-user-2$/);
    await page.goto(`http://127.0.0.1:${port}/login`);
    await expect(
      page.getByRole("link", { name: "Sign in with Okta" }),
    ).toHaveAttribute(
      "href",
      `http://127.0.0.1:${region === "kr" ? 3209 : 3210}/auth/${region}`,
    );
  }
});
test("all lists use API empty results; session and locale are forwarded", async ({
  page,
  context,
}) => {
  for (const route of [
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
    await expect(page.getByText("Unable to load this page")).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(0);
  }
  await context.addCookies([
    { name: "orion_session", value: "valid", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/users");
  await expect(
    page.getByRole("link", { name: "Authenticated API user" }),
  ).toBeVisible();
  await page.getByLabel("Language / 언어").selectOption("ko");
  await expect(page.getByRole("link", { name: "Live kr ko" })).toBeVisible();
});
test("API 404, access denial and malformed payloads fail without sample fallback", async ({
  page,
}) => {
  await page.goto("/users/missing");
  await expect(
    page.getByRole("heading", { name: "User not found" }),
  ).toBeVisible();
  for (const id of ["denied", "broken"]) {
    await page.goto("/users/" + id);
    await expect(
      page.getByRole("heading", { name: "Unable to load this page" }),
    ).toBeVisible();
    await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
    await expect(page.getByText("do not expose")).toHaveCount(0);
  }
});
