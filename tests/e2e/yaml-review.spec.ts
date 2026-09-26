import { test, expect } from "@playwright/test";
test("row review pairs scoped YAML diff and impact without implicit apply", async ({
  page,
}) => {
  await page.goto("/resources?type=policies&status=out-of-sync");
  await page.getByRole("button", { name: "변경 검토", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".yaml-code")).toContainText("phone");
  await dialog.getByRole("tab", { name: "영향도", exact: true }).click();
  await expect(dialog.locator(".def-subject")).toHaveCount(3);
  await expect(dialog.locator(".yaml-code")).toBeHidden();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.locator(".sync-status")).toHaveText("Out of sync");
});
