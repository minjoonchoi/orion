import { test, expect } from "@playwright/test";
test("detail sync target includes required parents and cancellation preserves pending changes", async ({
  page,
}) => {
  await page.goto("/service-endpoints/identity-api~detail");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("services:identity-api");
  await expect(dialog).not.toContainText("directory-api");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "대상으로 돌아가기", exact: true })
    .click();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page.reload();
  await expect(page.locator(".sync-status")).toHaveText("Out of sync");
});
