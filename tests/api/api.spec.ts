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
    await page.getByRole("tab", { name: "Roles (0)", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No records", exact: true }),
    ).toBeVisible();
    await page.goto(`http://127.0.0.1:${port}/users/remote-user-2`);
    await expect(
      page.getByRole("heading", { name: `Live ${region} en`, exact: true }),
    ).toBeVisible();
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
  await context.addCookies([
    {
      name: "orion_session",
      value: "api-empty",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
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
  await page.goto("/users/denied");
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
  for (const id of ["broken"]) {
    await page.goto("/users/" + id);
    await expect(
      page.getByRole("heading", { name: "Unable to load this page" }),
    ).toBeVisible();
    await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
    await expect(page.getByText("do not expose")).toHaveCount(0);
  }
});

test("platform role assignments persist API responses and reject failed writes", async ({
  page,
  context,
}) => {
  for (const value of [
    "platform-ok",
    "platform-conflict",
    "platform-forbidden",
  ]) {
    await context.addCookies([
      { name: "orion_session", value, domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/roles/remote-role?tab=users");
    await page.getByRole("button", { name: "Add users", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("checkbox", { name: /Remote user remote-user@example.test/ })
      .check();
    await dialog
      .getByRole("button", { name: "Review changes & impact", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    if (value === "platform-ok") {
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("table", { name: "Users list", exact: true }),
      ).toContainText("Remote user");
      await page.goto("/users/remote-user?tab=roles");
      await expect(
        page.getByRole("link", { name: "Remote role", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: "Platform (0)", exact: true }),
      ).toBeVisible();
    } else {
      await expect(dialog.getByRole("alert")).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "No records", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Remote user", exact: true }),
      ).toHaveCount(0);
    }
  }
});
test("platform directory denies or rejects malformed data without demo fallback", async ({
  page,
  context,
}) => {
  for (const value of ["directory-forbidden", "directory-malformed"]) {
    await context.addCookies([
      { name: "orion_session", value, domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/roles");
    await expect(
      page.getByRole("heading", {
        name:
          value === "directory-forbidden"
            ? "Access denied"
            : "Unable to load this page",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
  }
});
test("logout failure keeps session; confirmed backend logout clears the cookie and navigates to login", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "orion_session",
      value: "logout-fail",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/users");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page.locator("header").getByRole("alert")).toContainText(
    "Unable to sign out",
  );
  expect(
    (await context.cookies()).find((c) => c.name === "orion_session")?.value,
  ).toBe("logout-fail");
  await context.addCookies([
    {
      name: "orion_session",
      value: "logout-ok",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page
    .locator("header")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some((c) => c.name === "orion_session"),
  ).toBe(false);
});

test("definition status, scoped preview and apply use API responses; denied and malformed data never become demo", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "orion_session",
      value: "definitions",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/service-endpoints/identity-api~detail");
  await expect(
    page.getByRole("heading", { name: "Remote endpoint", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("service-endpoints:identity-api/detail");
  await dialog
    .getByRole("button", { name: "Review changes & impact", exact: true })
    .click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Apply sync", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  for (const value of ["forbidden", "malformed"]) {
    await context.addCookies([
      { name: "orion_session", value, domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/resources");
    await expect(page.locator("main [role=alert]")).toBeVisible();
    await expect(page.locator(".def-demo")).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(0);
  }
});
