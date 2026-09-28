import { expect, type Page } from "@playwright/test";
export async function selectRoleUser(
  page: Page,
  roleId: string,
  user: string,
  operation: "add" | "remove" = "add",
) {
  if (!page.url().includes(`/roles/${roleId}`))
    await page.goto(`/roles/${roleId}?tab=users`);
  await page
    .getByRole("button", { name: "사용자 부여 관리", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = user === "member14@example.test" ? "송유진" : "김가람";
  await dialog
    .getByRole("checkbox", { name, exact: true })
    .setChecked(operation === "add");
  await dialog
    .getByRole("button", { name: "변경 내용 검토", exact: true })
    .click();
  await expect(dialog).toContainText(name);
  return dialog;
}
export async function applyRoleUser(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "확인 후 적용", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
