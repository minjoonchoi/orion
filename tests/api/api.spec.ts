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

test("authorization changes use real POST responses and handle conflicts and forbidden responses", async ({
  page,
  context,
}) => {
  await page.goto("/users/remote-user");
  await page.getByRole("button", { name: "Assign roles", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", { name: "Remote role", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Changes applied");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Assign roles", exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: "Remote role", exact: true }),
  ).toBeChecked();
  await context.addCookies([
    {
      name: "orion_session",
      value: "conflict",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await dialog
    .getByRole("checkbox", { name: "Remote role", exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "This configuration has changed",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await context.addCookies([
    {
      name: "orion_session",
      value: "forbidden",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.getByRole("button", { name: "Assign roles", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
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
