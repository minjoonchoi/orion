import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("login has a standalone layout and ignores untrusted destination query parameters", async ({
  page,
}) => {
  await page.goto(
    "/login?redirect=https://untrusted.example.test&error=secret-details",
  );
  await expect(page).toHaveTitle("로그인 | Orion");
  await expect(
    page.getByRole("heading", { name: "Orion에 로그인" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Okta로 로그인" }),
  ).toHaveAttribute("href", "http://127.0.0.1:3100/__test/auth/login");
  await expect(page.getByText("secret-details", { exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Okta로 로그인" })).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("a document GET follows the Orion API redirect without browser-side OIDC or JavaScript", async ({
  browser,
}) => {
  const idp = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<h1>Mock identity provider</h1>");
  });
  await new Promise<void>((resolve) => idp.listen(0, "127.0.0.1", resolve));
  const target = `http://127.0.0.1:${(idp.address() as AddressInfo).port}/authorize`;
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    let requestType = "";
    let method = "";
    await page.route("**/__test/auth/login", async (route) => {
      requestType = route.request().resourceType();
      method = route.request().method();
      await route.fulfill({ status: 302, headers: { location: target } });
    });
    await page.goto("http://127.0.0.1:3100/login");
    await page.getByRole("link", { name: "Okta로 로그인" }).click();
    await expect(page).toHaveURL(target);
    await expect(
      page.getByRole("heading", { name: "Mock identity provider" }),
    ).toBeVisible();
    expect(requestType).toBe("document");
    expect(method).toBe("GET");
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      idp.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("login adapts to mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Okta로 로그인" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
