import { test, expect } from "@playwright/test";
test("stale definition preview cannot overwrite a concurrent sync", async ({
  page,
  context,
}) => {
  await page.goto("/policies/policy-platform");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const other = await context.newPage();
  await other.goto("/service-endpoints/identity-api~detail");
  await other.getByRole("button", { name: "동기화", exact: true }).click();
  const edit = other.getByRole("dialog");
  await edit
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await edit.getByRole("checkbox").check();
  await edit.getByRole("button", { name: "동기화 적용", exact: true }).click();
  await expect(edit).toHaveCount(0);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "동기화 적용", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "버전이 변경되었습니다",
  );
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("미포함");
  await other.reload();
  await expect(other.locator(".sync-status")).toHaveText("Synced");
});
