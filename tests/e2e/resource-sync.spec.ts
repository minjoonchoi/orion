import { test, expect } from "@playwright/test";
test("stale definition preview cannot overwrite a concurrent permission change", async ({
  page,
  context,
}) => {
  await page.goto("/policies/policy-platform");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const other = await context.newPage();
  await other.goto("/users/usr-014?tab=roles");
  await other.getByRole("button", { name: "역할 부여", exact: true }).click();
  const edit = other.getByRole("dialog");
  await edit
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await edit
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await edit.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(edit.getByRole("status")).toContainText(
    "변경사항을 적용했습니다",
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "동기화 적용", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "버전이 변경되었습니다",
  );
});
