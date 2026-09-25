import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("item review keeps YAML and impact scoped to one resource", async ({
  page,
}) => {
  await page.goto("/resources?status=out-of-sync");
  const row = page.getByRole("row").filter({ hasText: "ep-users-list" });
  await expect(row.locator(".sync-status")).toHaveText("Out of sync");
  await row.getByRole("button", { name: /변경 검토/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("tab", { name: "YAML diff", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(dialog.locator(".yaml-code")).toContainText("ep-users-list");
  await expect(dialog.locator(".yaml-code")).not.toContainText(
    "policy-platform",
  );
  await expect(dialog.locator(".yaml-line.add").first()).toBeVisible();
  await dialog.getByRole("tab", { name: "영향도", exact: true }).click();
  await expect(dialog.locator(".subject-impact")).toBeVisible();
  await expect(dialog.locator(".yaml-code")).toBeHidden();
  await dialog.getByRole("tab", { name: "YAML diff", exact: true }).click();
  await expect(dialog.locator(".yaml-code")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("English mobile policy review keeps both views and apply consent", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resources?type=policies&resource=policy-platform");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".yaml-code")).toContainText("processors:");
  await dialog.getByRole("tab", { name: "Impact", exact: true }).click();
  await expect(dialog.locator(".subject-impact")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
