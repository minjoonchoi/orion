import { expect, type Page } from "@playwright/test";
export async function selectRoleUser(
  page: Page,
  roleId: string,
  user: string,
  operation: "add" | "remove" = "add",
) {
  await page.goto(`/roles/${roleId}?tab=users`);
  await page
    .getByRole("button", {
      name: operation === "add" ? "사용자 추가" : "사용자 해제",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("사용자 검색", { exact: true }).fill(user);
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(dialog).toContainText(user);
  return dialog;
}
export async function applyRoleUser(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
